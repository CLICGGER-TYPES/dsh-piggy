"""Review protocol regressions using private files and a loopback server."""
import contextlib
import hashlib
import http.client
import json
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path

from server import Handler, ReviewServer, ReviewState
from publish import publish

HERE = Path(__file__).resolve().parent


class QuietHandler(Handler):
    def log_message(self, *_args):
        pass


@contextlib.contextmanager
def review_server(root, private):
    state = ReviewState(root, private)
    server = ReviewServer(('127.0.0.1', 0), QuietHandler, state)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server.server_port, state
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def request(port, method='GET', payload=None):
    conn = http.client.HTTPConnection('127.0.0.1', port, timeout=3)
    try:
        body = None if payload is None else json.dumps(payload)
        conn.request(method, '/__review/state' if payload is None else '/__review/issue',
                     body, {'Content-Type': 'application/json'})
        response = conn.getresponse()
        return response.status, json.loads(response.read())
    finally:
        conn.close()


class ReviewProtocolTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='piggy-review-test-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.public = self.base / 'public'
        self.private = self.base / 'private'
        self.public.mkdir()
        self.private.mkdir()
        self.original = self.base / 'original.png'
        self.original.write_bytes(b'private image fixture v1')
        self.sha = hashlib.sha256(self.original.read_bytes()).hexdigest()
        self.entry = {'id': 'gardener/idle', 'sha256': self.sha, 'label': '园丁待机',
                      'image': 'originals/gardener/idle.png', 'working_original': str(self.original)}
        self.write_registry()

    def write_registry(self):
        (self.private / 'registry.json').write_text(json.dumps({'images': [self.entry]}))

    def mark(self, **patch):
        return dict({'id': self.entry['id'], 'sha256': self.sha,
                     'needs_revision': True, 'note': '帽子边界不清楚'}, **patch)

    def read_issues(self):
        run = subprocess.run([sys.executable, str(HERE / 'read-issues.py'),
                              '--state-dir', str(self.private)], capture_output=True, text=True, check=True)
        return json.loads(run.stdout)

    def test_notes_survive_reload_and_omitted_note_update(self):
        with review_server(self.public, self.private) as (port, _):
            status, _ = request(port, 'POST', self.mark())
            self.assertEqual(status, 200)
            payload = self.mark()
            del payload['note']
            status, _ = request(port, 'POST', payload)
            self.assertEqual(status, 200)
        with review_server(self.public, self.private) as (port, _):
            status, state = request(port)
            self.assertEqual(status, 200)
            self.assertTrue(state['issues'][0]['active'])
            self.assertEqual(state['issues'][0]['note'], '帽子边界不清楚')
        read = self.read_issues()
        self.assertEqual(read['active_count'], 1)
        self.assertTrue(read['active'][0]['working_original_matches'])

    def test_new_revision_preserves_old_feedback_and_rejects_stale_updates(self):
        with review_server(self.public, self.private) as (port, _):
            self.assertEqual(request(port, 'POST', self.mark())[0], 200)
            self.original.write_bytes(b'private image fixture v2')
            self.entry['sha256'] = hashlib.sha256(self.original.read_bytes()).hexdigest()
            self.write_registry()
            self.assertEqual(request(port, 'POST', self.mark(note='stale note'))[0], 409)
            self.assertFalse(request(port)[1]['issues'][0]['active'])
            self.assertEqual(self.read_issues()['active_count'], 0)
            self.assertEqual(request(port, 'POST', self.mark(sha256=self.entry['sha256'], note='新稿鼻子要改'))[0], 200)
            read = self.read_issues()
            self.assertEqual(read['active_count'], 1)
            self.assertEqual(read['active'][0]['note'], '新稿鼻子要改')
            self.assertEqual(len(read['previous_versions']), 1)
            self.assertEqual(request(port, 'POST', self.mark(sha256=self.entry['sha256'], needs_revision=False))[0], 200)
            read = self.read_issues()
            self.assertEqual(read['active_count'], 0)
            self.assertEqual(len(read['previous_versions']), 1)

    def test_republishing_same_version_does_not_overwrite_feedback(self):
        source = self.base / 'production'
        source.mkdir()
        (source / 'delivery-manifest.json').write_text(json.dumps({'records': [{
            'character': 'gardener', 'scene': 'idle', 'original': str(self.original),
            'export': str(self.original), 'sha256': self.sha}]}))
        (source / 'review.html').write_text('<html><header></header><figure data-scene="idle">'
                                          '<a href="gardener/idle.png">原图</a></figure></html>')
        with contextlib.redirect_stdout(None):
            publish(source, self.public, self.private)
        with review_server(self.public, self.private) as (port, _):
            self.assertEqual(request(port, 'POST', self.mark())[0], 200)
        before = (self.private / 'structure-issues.json').read_bytes()
        with contextlib.redirect_stdout(None):
            publish(source, self.public, self.private)
        self.assertEqual((self.private / 'structure-issues.json').read_bytes(), before)
        page = (self.public / 'index.html').read_text()
        self.assertIn('data-review-id="gardener/idle"', page)
        self.assertIn('data-review-hash="' + self.sha + '"', page)
        self.assertEqual((self.public / 'originals/gardener/idle.png').read_bytes(), self.original.read_bytes())


    def source_with(self, records):
        source = self.base / 'production'
        source.mkdir(exist_ok=True)
        (source / 'delivery-manifest.json').write_text(json.dumps({'records': records}))
        (source / 'review.html').write_text('<html><header></header><figure data-scene="idle">'
                                            '<a href="gardener/idle.png">原图</a></figure></html>')
        return source

    def valid_record(self, **patch):
        record = {'character': 'gardener', 'scene': 'idle', 'original': str(self.original),
                  'export': str(self.original), 'sha256': self.sha}
        record.update(patch)
        return record

    def test_private_state_must_be_disjoint_from_public_root(self):
        with self.assertRaises(ValueError):
            ReviewState(self.public, self.public / 'private')
        with self.assertRaises(ValueError):
            ReviewState(self.public / 'root', self.public)

    def test_publish_rejects_overlapping_roots_before_writing(self):
        with self.assertRaises(ValueError):
            publish(self.base, self.public, self.private)
        self.assertFalse((self.private / 'registry.json').exists())

    def test_publish_rejects_unsafe_duplicate_and_missing_preview_before_writing(self):
        unsafe = self.source_with([self.valid_record(character='../escape')])
        with self.assertRaises(ValueError):
            publish(unsafe, self.public, self.private)
        self.assertFalse((self.private / 'registry.json').exists())
        self.assertFalse((self.public / 'originals').exists())

        duplicate = self.source_with([self.valid_record(), self.valid_record()])
        with self.assertRaises(ValueError):
            publish(duplicate, self.public, self.private)

        missing = self.source_with([self.valid_record(export=str(self.base / 'missing.png'))])
        with self.assertRaises(ValueError):
            publish(missing, self.public, self.private)
        self.assertFalse((self.private / 'registry.json').exists())
        self.assertFalse((self.public / 'originals').exists())

    def test_publish_rejects_extra_image_mismatch_before_writing(self):
        source = self.source_with([self.valid_record()])
        (self.public / 'designs').mkdir()
        (self.public / 'designs/bad.png').write_bytes(b'not the registered image')
        (self.private / 'extra-images.json').write_text(json.dumps({'images': [{
            'id': 'design/bad', 'image': 'designs/bad.png', 'sha256': '0' * 64,
            'label': 'bad', 'working_original': str(self.original)}]}))
        with self.assertRaises(ValueError):
            publish(source, self.public, self.private)
        self.assertFalse((self.private / 'registry.json').exists())
        self.assertFalse((self.public / 'originals').exists())

    def test_publish_keeps_existing_state_on_validation_failure(self):
        source = self.source_with([self.valid_record(export=str(self.base / 'missing.png'))])
        (self.private / 'registry.json').write_text('{"images": []}\n')
        (self.private / 'structure-issues.json').write_text('[]\n')
        with self.assertRaises(ValueError):
            publish(source, self.public, self.private)
        self.assertEqual((self.private / 'registry.json').read_text(), '{"images": []}\n')
        self.assertEqual((self.private / 'structure-issues.json').read_text(), '[]\n')


if __name__ == '__main__':
    unittest.main()
