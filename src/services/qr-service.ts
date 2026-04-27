import QRCode from "qrcode";

/**
 * Generates a QR code PNG image as a Buffer from a UUID string.
 * The QR code contains only the UUID (no personal data).
 * Returns PNG-formatted binary data suitable for saving to disk or embedding.
 * Uses moderate error correction ("M") to balance size and reliability.
 */
export async function generateQrBuffer(uuid: string): Promise<Buffer> {
  // Generate QR code PNG image from the UUID
  return QRCode.toBuffer(uuid, {
    type: "png", // Output format: PNG image
    width: 900, // Image width in pixels (900x900)
    margin: 1, // Margin around QR code (1 module)
    errorCorrectionLevel: "M", // Medium error correction (30% recovery capacity)
    color: {
      dark: "#000000", // QR code modules: black
      light: "#FFFFFF", // Background: white
    },
  });
}
