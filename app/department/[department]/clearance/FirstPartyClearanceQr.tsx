import { qrcode } from '@/lib/vendor/qrcode.mjs';
// All SVG markup comes from a locally bundled, MIT-licensed encoder.
// URL contains only a random-nonce AES-GCM certificate, not a student ID.
export default function FirstPartyClearanceQr({ url }: { url: string }) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
  return <div role="img" aria-label="First-party CLEAR clearance verification QR"
    className="bg-white p-3 rounded mx-auto" style={{width:240,maxWidth:'100%'}}
    dangerouslySetInnerHTML={{__html:svg}}/>;
}
