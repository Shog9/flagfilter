var dots = require("dot").process({path: "./views"});
var properties = [];
for (var key in dots) 
{
    properties.push(JSON.stringify(key)+': '+dots[key].toString().replace("function anonymous", "function"));
}
require("fs").writeFileSync("flagTemplates.js", "FlagFilter.templates = {" + properties.join(",\n") + "};");
