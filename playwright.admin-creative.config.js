const base=require('./playwright.admin-correction.config');
module.exports={...base,timeout:300000,testMatch:'admin-creative.spec.js',reporter:[['list'],['json',{outputFile:'artifacts/admin-creative-results.json'}]]};
