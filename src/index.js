if (process.env.ASYNC_DUMP) {
    require('./asyncDump');
}

const path = require('path');
const { _, fs } = require('rk-utils');
const Suite = require('./Suite');

module.exports = (file, body, { before: onBefore, after: onAfter, serverEntry, verbose } = {}) => {
    const suiteName = path.basename(file, '.spec.js');
    const suite = new Suite(suiteName, { serverEntry, verbose });

    const testOptsFile = path.resolve('test/test.local.js');

    let opt;    

    if (fs.existsSync(testOptsFile)) {
        const testOpts = require(testOptsFile);        
        const only = new Set(testOpts.only);        

        if (only.has(suiteName)) {
            opt = 'only';   
        } else {
            if (!_.isEmpty(testOpts.only)) {                
                console.log(`Suite "${suiteName}" skipped.`);
            } else {
                const skip = new Set(testOpts.skip);
                if (skip.has(suiteName)) {
                    opt = 'skip';
                    console.log(`Suite "${suiteName}" skipped.`);
                }
            }            
        }        
    }

    (opt ? describe[opt] : describe)(suiteName, function () {
        before(async () => {
            suite.initAllure();

            if (verbose) {
                console.log('Starting suite:', suiteName);
            }

            if (process.env.COVER_MODE) {
                await suite.startWebServer_();
            }            

            if (onBefore) {
                await onBefore();
            }
        });   

        after(async () => {
            await suite.stopWebServerIfStarted_();    

            if (onAfter) {
                await onAfter();                    
            }
            
            console.log();
            if (verbose) {
                console.log('Finished suite:', suiteName);
            }

            if (process.env.ASYNC_DUMP) {
                asyncDump(process.env.ASYNC_DUMP.length > 1 ? process.env.ASYNC_DUMP : null);
            }
        }); 

        body(suite);
    });
}