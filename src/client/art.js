// @ts-check
/**
 * 选立绘：有动作立绘的形态（加冕后的猪猪王等，见 data/evolution.js）在喂食、
 * 打工、上学、旅行时换成对应那张，照顾的反应盖过外出的样子，反应结束换回来。
 * 立绘来自 PR #2（作者 1nuoiscute）。
 * @module dsh-piggy/client/art
 */
import { ART_URL } from './constants.js'
import { feedbackArtFor, OPAQUE_FEEDBACK_ART } from './feedback-art.js'

var REACTION_ART = { feed: 'eat', bathe: 'bathe', play: 'play', pet: 'pet', cure: 'relaxed', levelup: 'relaxed' }
var ACTIVITY_ART = { work: 'work', study: 'study', interest: 'study', trip: 'trip', fishing: 'fish' }

var SLEEP_ART = new Set([
  'piglet', 'pig-round', 'pig-fat', 'pig-king', 'pig-devil',
  'skin-mint', 'career-chef', 'career-astronaut', 'skin-detective',
  'skin-angel', 'skin-pirate', 'skin-wizard',
])

/** Use a custom sleep pose when supplied; otherwise fall back to built-in sleep art. */
export function syncSleepArt(art, scenes, image) {
  var custom = typeof art === 'string' && art.startsWith('custom-') && scenes.includes('sleep')
  var name = SLEEP_ART.has(art) ? art : 'piglet'
  var src = ART_URL + (custom ? art + '-sleep.svg' : name + '-sleep.png')
  if (image.getAttribute('src') !== src) image.src = src
}

/**
 * Point the pig's <img> at the sprite its attributes call for. Only touches
 * `src` when it changes, so polling never refetches the image.
 * @param {object} pig   the .dp-pig node (data-art / data-art-actions / data-react / data-activity)
 * @param {object} image the <img> inside it
 */
export function syncPigArt(pig, image, emoji) {
  var base = pig.getAttribute('data-art') || ''
  var feedback = feedbackArtFor({
    stage: pig.getAttribute('data-stage') || '', base: base,
    mood: pig.getAttribute('data-mood') || '', reaction: pig.getAttribute('data-react') || '',
    idle: pig.getAttribute('data-idle') || '', activityKind: pig.getAttribute('data-activity') || '',
    activityKey: pig.getAttribute('data-activity-key') || '', hour: Math.floor(Date.now() / 3_600_000),
  })
  if (feedback) {
    var feedbackSrc = ART_URL + 'feedback/' + feedback + '.png'
    if (image.getAttribute('src') !== feedbackSrc) image.src = feedbackSrc
    image.hidden = false
    pig.setAttribute('data-feedback', 'true')
    pig.setAttribute('data-feedback-opaque', OPAQUE_FEEDBACK_ART.has(feedback) ? 'true' : 'false')
    if (emoji) emoji.hidden = true
    return true
  }
  if (!base) {
    image.hidden = true
    if (image.getAttribute('src')) image.removeAttribute('src')
    pig.setAttribute('data-feedback', 'false')
    pig.setAttribute('data-feedback-opaque', 'false')
    if (emoji) emoji.hidden = false
    return false
  }
  var art = base
  if (pig.getAttribute('data-art-actions') === 'true') {
    var action = REACTION_ART[pig.getAttribute('data-react')] || ACTIVITY_ART[pig.getAttribute('data-activity')]
    var scenes = String(pig.getAttribute('data-art-scenes') || '').split(',')
    if (action && (scenes[0] === '' || scenes.indexOf(action) >= 0)) art += '-' + action
  }
  var src = ART_URL + art + '.svg'
  if (image.getAttribute('src') !== src) image.src = src
  image.hidden = false
  pig.setAttribute('data-feedback', 'false')
  pig.setAttribute('data-feedback-opaque', 'false')
  if (emoji) emoji.hidden = true
  return true
}
