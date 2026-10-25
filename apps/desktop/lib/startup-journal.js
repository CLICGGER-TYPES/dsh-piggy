// @ts-check
/**
 * 启动日志（userData/piggy.log）的行格式和写入。
 *
 * main.js 的 log() 和 launcher.js 的启动失败报告共用这一份，日志里是同一个样子，
 * 排查时不用分辨哪一行是哪个进程写的。写入失败一律只返回 false：
 * 诊断不许反过来挡住启动或退出。
 *
 * @module dsh-piggy-desktop/startup-journal
 */
import { appendFile, appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * 一行启动日志，和 main.js 以前的 `[ISO] 内容` 格式逐字一致。
 * @param {readonly unknown[]} parts
 * @param {Date} [at]
 */
export function journalLine(parts, at = new Date()) {
  return `[${at.toISOString()}] ${parts.join(' ')}\n`
}

/**
 * 追加一行（异步）。回调里才 resolve，调用方可以先等落盘再弹对话框。
 * @param {string} file
 * @param {string} line
 * @param {(file: string, line: string, done: (error?: unknown) => void) => void} [append]
 * @returns {Promise<boolean>} 是否写进去了
 */
export function appendJournal(file, line, append = appendFile) {
  return new Promise(resolve => {
    try {
      mkdirSync(dirname(file), { recursive: true })
      append(file, line, error => resolve(!error))
    } catch {
      resolve(false)
    }
  })
}

/**
 * 同步版：只在拿不到单实例锁、马上要退出的进程里用一次，不在运行期热路径上。
 * 异步写入会拉长「拿不到锁」到「退出」之间的时间，第二个进程可能已经开始初始化。
 * @param {string} file
 * @param {string} line
 * @param {(file: string, line: string) => void} [append]
 */
export function appendJournalSync(file, line, append = appendFileSync) {
  try {
    mkdirSync(dirname(file), { recursive: true })
    append(file, line)
    return true
  } catch {
    return false
  }
}
