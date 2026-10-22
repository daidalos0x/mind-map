// import JsPDF from '../utils/jspdf'
import { readBlob } from '../utils/index'

// pdf-lib 约 900KB，只有真正导出 PDF 时才需要，改成按需加载
let pdfLibPromise = null

const loadPdfLib = () => {
  if (!pdfLibPromise) {
    pdfLibPromise = import(/* webpackChunkName: "pdf-lib" */ 'pdf-lib')
  }
  return pdfLibPromise
}

//  导出PDF插件，需要通过Export插件使用
class ExportPDF {
  //  构造函数
  constructor(opt) {
    this.mindMap = opt.mindMap
  }

  //  使用pdf-lib库导出为pdf
  async pdf(img) {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = async () => {
        const imageWidth = image.width
        const imageHeight = image.height
        const { PDFDocument } = await loadPdfLib()
        // 创建pdf页面，尺寸设置为图片的大小
        const pdfDoc = await PDFDocument.create()
        const page = pdfDoc.addPage()
        page.setSize(imageWidth, imageHeight)
        // 添加图片到pdf
        const pngImage = await pdfDoc.embedPng(img)
        page.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: imageWidth,
          height: imageHeight
        })
        const pdfBytes = await pdfDoc.save()
        const blob = new Blob([pdfBytes])
        const res = await readBlob(blob)
        resolve(res)
      }
      image.onerror = e => {
        reject(e)
      }
      image.src = img
    })
  }

  //  使用jspdf库导出为pdf
  // async pdf(name, img) {
  //   return new Promise((resolve, reject) => {
  //     const image = new Image()
  //     image.onload = () => {
  //       const imageWidth = image.width
  //       const imageHeight = image.height
  //       const pdf = new JsPDF({
  //         unit: 'px',
  //         format: [imageWidth, imageHeight],
  //         compress: true,
  //         hotfixes: ['px_scaling'],
  //         orientation: imageWidth > imageHeight ? 'landscape' : 'portrait'
  //       })
  //       pdf.addImage(img, 'PNG', 0, 0, imageWidth, imageHeight)
  //       pdf.save(name)
  //       resolve()
  //     }
  //     image.onerror = e => {
  //       reject(e)
  //     }
  //     image.src = img
  //   })
  // }
}

ExportPDF.instanceName = 'doExportPDF'

export default ExportPDF
