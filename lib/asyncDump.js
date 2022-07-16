"use strict";
const { createHook  } = require("async_hooks");
const { stackTraceFilter  } = require("mocha/lib/utils");
const fs = require("fs");
const allResources = new Map();
// this will pull Mocha internals out of the stacks
const filterStack = stackTraceFilter();
const hook = createHook({
    init (asyncId, type, triggerAsyncId) {
        allResources.set(asyncId, {
            type,
            triggerAsyncId,
            stack: new Error().stack
        });
    },
    destroy (asyncId) {
        allResources.delete(asyncId);
    }
}).enable();
global.asyncDump = module.exports = (dumpFile)=>{
    hook.disable();
    const logs = [];
    allResources.forEach((value)=>{
        logs.push(`Type: ${value.type}`);
        logs.push(filterStack(value.stack));
        logs.push("\n");
    });
    fs.writeFileSync(dumpFile || "async-dump.log", logs.join("\n"));
};

//# sourceMappingURL=asyncDump.js.map