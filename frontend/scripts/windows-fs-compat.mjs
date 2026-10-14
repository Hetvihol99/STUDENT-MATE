import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
// Some Windows sandbox/filesystem combinations reject the native realpath API
// even when ordinary file access is permitted. Fall back to Node's JS resolver.
if(process.platform==='win32') {const native=fs.realpathSync.native;fs.realpathSync.native=(...args)=>{try{return native(...args)}catch(e){if(e.code==='EPERM')return fs.realpathSync(...args);throw e}};syncBuiltinESMExports()}
