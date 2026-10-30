import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'
import { caseDetail } from './case-fixtures.mjs'
import { scope } from './event-fixtures.mjs'
import { initialCasesState } from '../src/features/cases/state/state.ts'
test('workflow UI exposes labelled controls, explicit version adoption/replay and safe read-only guards',async()=>{
 const server=await createServer({configFile:false,cacheDir:'node_modules/.tmp/ssr-case-workflow',server:{middlewareMode:true,hmr:false,ws:false}})
 try {
 const {WorkflowForm}=await server.ssrLoadModule('/src/features/cases/components/WorkflowForm.tsx')
 const initial=initialCasesState()
 const render=(patch={})=>renderToString(createElement(WorkflowForm,{detail:caseDetail(),scope:scope(),ready:true,workflow:initial.workflow,graph:initial.workflowGraph,submit:async()=>{},retry:async()=>{},beginNew(){},...patch})).replace(/<!--.*?-->/g,'')
 const html=render();assert.match(html,/Giao cho tôi/);assert.match(html,/Người xử lý/);assert.match(html,/Case.version đã chọn: 1/);assert.match(html,/verification_failed/)
 assert.match(html,/role="combobox"[^>]*aria-label="Chọn người xử lý"/)
 assert.match(html,/Mở danh sách để tải người nhận đủ quyền/)
 assert.doesNotMatch(html,/hiện chưa có danh sách|<input[^>]*type="text"[^>]*name="owner_id"/)
 const notEligible=render({assignees:{status:'ready',items:[],error:null}})
 assert.match(notEligible,/<button[^>]*disabled=""[^>]*>Giao cho tôi/)
 assert.equal(render({scope:scope(false)}),'');assert.match(render({ready:false}),/fieldset disabled/)
 assert.match(render({workflow:{...initial.workflow,status:'conflict',error:{code:'VERSION_CONFLICT',message:'<script>'}}}),/Dùng phiên bản hồ sơ hiện tại/)
 assert.match(render({workflow:{...initial.workflow,status:'uncertain'}}),/Gửi lại thao tác/)
 assert.match(render({workflow:{...initial.workflow,status:'success'},ready:false}),/Chưa tải được thông tin mới/)
 }finally{await server.close()}
})
