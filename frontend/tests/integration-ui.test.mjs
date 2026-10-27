import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { createServer } from 'vite'
import { caseDetail, CID } from './case-fixtures.mjs'
import { WID } from './event-fixtures.mjs'
test('integration UI: actual case detail composes role guards and hides artifacts during logout/access refresh',async()=>{
 const server=await createServer({configFile:false,cacheDir:'node_modules/.tmp/ssr-integration',server:{middlewareMode:true,hmr:false,ws:false}})
 try{
 const [{CaseDetailPage},{AuthContext},{WorkspaceContext},{CasesContext},{initialCasesState},{workspacePermissions}]=await Promise.all([
  server.ssrLoadModule('/src/pages/CaseDetailPage.tsx'),server.ssrLoadModule('/src/features/auth/authContext.ts'),server.ssrLoadModule('/src/features/workspace/workspaceContext.ts'),server.ssrLoadModule('/src/features/cases/casesContext.ts'),server.ssrLoadModule('/src/features/cases/state.ts'),server.ssrLoadModule('/src/features/workspace/state.ts')])
 const noop=()=>{},asyncNoop=async()=>{}
 function render(role,{auth='authenticated',access='ready',state='awaiting_verification'}={}){
  const member={workspace_id:WID,roles:[role],group_ids:[]},permissions=workspacePermissions(member)
  const me={subject:'integration-user',memberships:[member]},scope={subject:me.subject,workspaceId:WID,accessKey:me,canWrite:permissions.canWrite,canVerify:permissions.canVerify}
  const detail=caseDetail();detail.case={...detail.case,state,owner_id:me.subject,title:'Sensitive case artifact'}
  const cases={...initialCasesState(scope),detail:{status:'ready',id:CID,data:detail,error:null}}
  const value={state:cases,refresh:noop,setFilters:noop,previousPage:noop,nextPage:noop,loadEvidenceSnapshot:asyncNoop,submitEvidence:asyncNoop,beginNewEvidence:noop,submitTransition:asyncNoop,retryTransition:asyncNoop,beginNewTransition:noop}
  return renderToString(createElement(MemoryRouter,{initialEntries:['/cases/'+CID]},createElement(AuthContext.Provider,{value:{state:{status:auth},signIn:asyncNoop,signOut:asyncNoop}},createElement(WorkspaceContext.Provider,{value:{state:{status:access,me,selectedWorkspaceId:WID,sources:{status:'ready',items:[],nextCursor:null,error:null}},membership:member,permissions,refreshAccess:asyncNoop,selectWorkspace:noop,loadMoreSources:asyncNoop}},createElement(CasesContext.Provider,{value},createElement(Routes,null,createElement(Route,{path:'/cases/:caseId',element:createElement(CaseDetailPage)}))))))).replace(/<!--.*?-->/g,'')
 }
 for(const role of ['viewer','admin']){const html=render(role);assert.match(html,/Sensitive case artifact/);assert.doesNotMatch(html,/Gửi transition|Thêm evidence hoặc note/)}
 const operator=render('operator');assert.match(operator,/Thêm evidence hoặc note/);assert.match(operator,/Thao tác này cần reviewer/);assert.match(operator,/<button type="submit" disabled="">Gửi transition/)
 const reviewer=render('reviewer');assert.match(reviewer,/<button type="submit">Gửi transition/);assert.doesNotMatch(reviewer,/Thao tác này cần reviewer/)
 for(const options of [{auth:'unauthenticated'},{access:'loading'},{access:'error'},{auth:'error'}])assert.doesNotMatch(render('reviewer',options),/Sensitive case artifact|Gửi transition|Thêm evidence hoặc note/)
 const closed=render('reviewer',{state:'closed'});assert.match(closed,/Case closed: chỉ đọc/);assert.match(closed,/<option value="reopen">reopen/)
 }finally{await server.close()}
})
