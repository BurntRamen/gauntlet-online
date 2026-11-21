const base=require('./playwright.admin-redesign.config');
module.exports={...base,testMatch:'admin-correction-before.spec.js',timeout:240000,expect:{timeout:45000},use:{...base.use,baseURL:'http://127.0.0.1:3300',actionTimeout:45000},webServer:[],reporter:[['list'],['json',{outputFile:'artifacts/admin-correction-before-results.json'}]]};
