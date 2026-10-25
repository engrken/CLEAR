export type QrMatrix={addData(data:string,mode?:'Byte'|'Alphanumeric'):void;make():void;createSvgTag(opts:{cellSize?:number;margin?:number;scalable?:boolean}):string;getModuleCount():number;};
export declare const qrcode:(version:number,correction:'L'|'M'|'Q'|'H')=>QrMatrix;
export default qrcode;
