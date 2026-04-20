import QRCode from "qrcode";

export async function generateQrBuffer(uuid: string): Promise<Buffer> {
  return QRCode.toBuffer(uuid, {
    type: "png",
    width: 900,
    margin: 1,
    errorCorrectionLevel: "M",
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}
