declare const process: { version:string; argv:string[]; env:Record<string,string|undefined>; stderr:{write(chunk:string):void}; stdout:{write(chunk:string):void}; exitCode?:number; };
declare module 'node:fs/promises' { export function mkdir(path:string, options?:{recursive?:boolean}):Promise<string|undefined>; export function readFile(path:string, encoding:'utf8'):Promise<string>; export function writeFile(path:string,data:string):Promise<void>; }
declare module 'node:path' { export function resolve(...paths:string[]):string; }
