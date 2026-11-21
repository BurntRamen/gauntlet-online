const base=require('./playwright.admin-redesign.config');
const path=require('node:path');
const fixtureRoot=process.env.GAUNTLET_CORRECTION_ROOT || path.resolve(__dirname,'.playwright-data/correction-'+Date.now());
process.env.GAUNTLET_CORRECTION_ROOT=fixtureRoot;
module.exports={...base,timeout:240000,testMatch:'admin-correction.spec.js',webServer:base.webServer.map((server,index)=>index?server:{...server,env:{...server.env,GAUNTLET_ASSET_FIXTURE_ROOT:fixtureRoot}}),reporter:[['list'],['json',{outputFile:'artifacts/admin-correction-results.json'}]]};
