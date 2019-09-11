import fs from 'fs'
import path from 'path'
import shelljs from 'shelljs'
import archiver from 'archiver'
import _ from 'lodash'
import OPF from './opf'
import TOC from './toc'

class Epub {
  opf = new OPF()
  toc = new TOC()

  basePath = path.resolve('.') // 基础路径
  bookname = '' // 书名

  bookIdentifier = 'helloworld' // id, 直接写死
  creator = 'zhihuhelp' // 创建者, 直接写死

  get currentPath () { return path.resolve(__dirname) }
  get resourcePath () { return path.resolve(this.currentPath, 'resource') }

  get epubCachePath () { return path.resolve(this.basePath) }
  get epubContentCachePath () { return path.resolve(this.epubCachePath, 'OEBPS') }
  get epubCacheHtmlPath () { return path.resolve(this.epubContentCachePath, 'html') }
  get epubCacheCssPath () { return path.resolve(this.epubContentCachePath, 'css') }
  get epubCacheImagePath () { return path.resolve(this.epubContentCachePath, 'image') }

  constructor (bookname: string, basePath: string) {
    this.basePath = basePath
    this.bookname = bookname

    this.opf.creator = this.creator
    this.toc.creator = this.creator

    this.opf.title = bookname
    this.toc.title = bookname

    this.initPath()
  }

  initPath () {
    shelljs.mkdir('-p', this.epubCachePath)
    shelljs.mkdir('-p', this.epubContentCachePath)
    shelljs.mkdir('-p', this.epubCacheCssPath)
    shelljs.mkdir('-p', this.epubCacheHtmlPath)
    shelljs.mkdir('-p', this.epubCacheImagePath)

    shelljs.mkdir('-p', path.resolve(this.epubCachePath, 'META-INF'))

    // 静态资源
    fs.copyFileSync(
      path.resolve(this.resourcePath, 'META-INF', 'container.xml'),
      path.resolve(this.epubCachePath, 'META-INF', 'container.xml')
    )
    fs.copyFileSync(
      path.resolve(this.resourcePath, 'META-INF', 'duokan-extension.xml'),
      path.resolve(this.epubCachePath, 'META-INF', 'duokan-extension.xml')
    )
    fs.copyFileSync(
      path.resolve(this.resourcePath, 'mimetype'),
      path.resolve(this.epubCachePath, 'mimetype')
    )
  }

  parseFilename (uri: string) {
    let uriSplitList = uri.split(path.sep)
    let filename = _.get(uriSplitList, uriSplitList.length - 1, '')
    return filename
  }

  addIndexHtml (title: string, uri: string) {
    let filename = this.parseFilename(uri)
    this.CopyFileSyncSafe(uri, path.resolve(this.epubCacheHtmlPath, filename))
    this.opf.addIndexHtml(filename)
    this.toc.addIndexHtml(title, filename)
  }

  addHtml (title: string, uri: string) {
    let filename = this.parseFilename(uri)
    this.CopyFileSyncSafe(uri, path.resolve(this.epubCacheHtmlPath, filename))
    this.opf.addHtml(filename)
    this.toc.addHtml(title, filename)
  }

  addCss (uri: string) {
    let filename = this.parseFilename(uri)
    this.CopyFileSyncSafe(uri, path.resolve(this.epubCacheCssPath, filename))
    this.opf.addCss(filename)
  }

  addImage (uri: string) {
    let filename = this.parseFilename(uri)
    this.CopyFileSyncSafe(uri, path.resolve(this.epubCacheImagePath, filename))
    this.opf.addImage(filename)
  }

  addCoverImage (uri: string) {
    let filename = this.parseFilename(uri)
    this.CopyFileSyncSafe(uri, path.resolve(this.epubCacheImagePath, filename))
    this.opf.addCoverImage(filename)
  }

  /**
   * 生成epub
   */
  async asyncGenerate () {
    let tocContent = this.toc.content
    fs.writeFileSync(path.resolve(this.epubContentCachePath, 'toc.xhtml'), tocContent)
    let opfContent = this.opf.content
    fs.writeFileSync(path.resolve(this.epubContentCachePath, 'content.opf'), opfContent)
    let epubWriteStream = fs.createWriteStream(path.resolve(this.epubCachePath, this.bookname + '.epub'))
    console.log('开始制作epub, 压缩为zip需要一定时间, 请等待')
    await new Promise((resolve, reject) => {
      let archive = archiver('zip', {
        zlib: { level: 0 } // Sets the compression level.
      })
      // listen for all archive data to be written
      // 'close' event is fired only when a file descriptor is involved
      epubWriteStream.on('close', function () {
        console.log(archive.pointer() + ' total bytes')
        console.log('epub制作完成')
        // console.log('archiver has been finalized and the output file descriptor has closed.')
        resolve()
      })

      // This event is fired when the data source is drained no matter what was the data source.
      // It is not part of this library but rather from the NodeJS Stream API.
      // @see: https://nodejs.org/api/stream.html#stream_event_end
      epubWriteStream.on('end', function () {
        console.log('epub制作完成')
        console.log('Data has been drained')
        resolve()
      })

      // good practice to catch warnings (ie stat failures and other non-blocking errors)
      archive.on('warning', function (err) {
        console.log('epub制作失败')
        reject(err)
        if (err.code === 'ENOENT') {
          // log warning
        } else {
          // throw error
          throw err
        }
      })

      // good practice to catch this error explicitly
      archive.on('error', function (err) {
        reject(err)
      })

      // pipe archive data to the file
      archive.pipe(epubWriteStream)

      // append files from a sub-directory, putting its contents at the root of archive
      archive.append(fs.createReadStream(path.resolve(this.epubCachePath, 'mimetype')), { name: 'mimetype' })
      archive.directory(`${path.resolve(this.epubCachePath, 'META-INF/')}`, 'META-INF')
      archive.directory(`${path.resolve(this.epubCachePath, 'OEBPS/')}`, 'OEBPS')

      // finalize the archive (ie we are done appending files but streams have to finish yet)
      // 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
      archive.finalize()
    })
  }

  private CopyFileSyncSafe (fromUri: string, toUri: string) {
    if (fs.existsSync(fromUri) === false) {
      return
    }
    fs.copyFileSync(fromUri, toUri)
    return
  }
}

export default Epub
