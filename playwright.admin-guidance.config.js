const base=require('./playwright.admin-correction.config');
module.exports={...base,testMatch:'admin-guidance.spec.js',reporter:[['list'],['json',{outputFile:'artifacts/admin-guidance-results.json'}]]};
