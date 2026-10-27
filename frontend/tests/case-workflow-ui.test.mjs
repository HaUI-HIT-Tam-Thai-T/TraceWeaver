import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'
import { caseDetail } from './case-fixtures.mjs'
import { scope } from './event-fixtures.mjs'
import { initialCasesState } from '../src/features/cases/state.ts'
test('workflow UI exposes labelled controls, explicit version adoption/replay and safe read-only guards',async()=>{
 const server=await createServer({configFile:false,cacheDir:'node_modules/.tmp/ssr-case-workflow',server:{middlewareMode:true,hmr:false,ws:false}})
 try {
 const {WorkflowForm}=await server.ssrLoadModule('/src/features/cases/WorkflowForm.tsx')
 const initial=initialCasesState()
 const render=(patch={})=>renderToString(createElement(WorkflowForm,{detail:caseDetail(),scope:scope(),ready:true,workflow:initial.workflow,graph:initial.workflowGraph,submit:async()=>{},retry:async()=>{},beginNew(){},...patch})).replace(/<!--.*?-->/g,'')
 const html=render();assert.match(html,/Giao cho tôi/);assert.match(html,/Owner subject/);assert.match(html,/Case.version đã chọn: 1/);assert.match(html,/verification_failed/)
 assert.equal(render({scope:scope(false)}),'');assert.match(render({ready:false}),/fieldset disabled/)
 assert.match(render({workflow:{...initial.workflow,status:'conflict',error:{code:'VERSION_CONFLICT',message:'<script>'}}}),/Dùng Case.version hiện tại/)
 assert.match(render({workflow:{...initial.workflow,status:'uncertain'}}),/Gửi lại thao tác/)
 assert.match(render({workflow:{...initial.workflow,status:'success'},ready:false}),/Chưa đồng bộ detail/)
 }finally{await server.close()}
})
