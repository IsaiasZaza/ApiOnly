// backend/controllers/certificate.controller.js
const PDFDocument = require('pdfkit');

/**
 * Gera o certificado em PDF.
 * @param {string} studentName - Nome do aluno.
 * @param {string} courseName - Nome do curso.
 * @returns {Promise<Buffer>} Buffer do PDF gerado.
 */
const generateCertificate = (studentName, courseName) => {
  return new Promise((resolve, reject) => {
    if (!studentName || !courseName) {
      return reject(new Error('Parâmetros ausentes: informe studentName e courseName'));
    }

    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      let buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Monta o conteúdo do certificado
      doc.fontSize(25).text('Certificado de Conclusão', { align: 'center' });
      doc.moveDown();
      doc.fontSize(20).text(`Certificamos que ${studentName}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(20).text(`concluiu o curso "${courseName}" com êxito!`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text(`Data: ${new Date().toLocaleDateString()}`, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateCertificate };
