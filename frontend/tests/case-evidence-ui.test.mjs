import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

test('evidence form defaults to Note, guards roles/closed/sync and distinguishes confirmed versus uncertain outcomes',async()=>{
  const server=await createServer({configFile:false,cacheDir:'node_modules/.tmp/ssr-case-evidence',server:{middlewareMode:true,hmr:false,ws:false}})
  try {
    const {EvidenceForm}=await server.ssrLoadModule('/src/features/cases/components/EvidenceForm.tsx')
    const render=(patch={})=>renderToString(createElement(EvidenceForm,{snapshot:{status:'idle',runId:null,events:[],error:null},mutation:{status:'idle',savedId:null,error:null},detailReady:true,closed:false,canWrite:true,loadSnapshot:async()=>{},submit:async()=>{},beginNew(){},...patch})).replace(/<!--.*?-->/g,'')
    const html=render();assert.match(html,/<option value="note">Ghi chú<\/option><option value="events">/);assert.doesNotMatch(html,/type="checkbox"/)
    assert.match(html,/Loại bằng chứng/);assert.match(html,/10.000/);assert.match(html,/phiên bản trạng thái do hệ thống quản lý/)
    assert.equal(render({canWrite:false}),'');assert.match(render({closed:true}),/Hồ sơ đã đóng: chỉ được xem/)
    assert.match(render({detailReady:false}),/fieldset disabled/)
    const uncertain=render({mutation:{status:'uncertain',savedId:null,error:null}})
    assert.match(uncertain,/Bắt đầu thêm bằng chứng mới/);assert.match(uncertain,/không tự gửi lại thao tác/)
    assert.match(render({mutation:{status:'success',savedId:'id',error:null},detailReady:false}),/Đã lưu bằng chứng/)
    assert.match(render({mutation:{status:'locked',savedId:null,error:null}}),/CASE_CLOSED/)
    assert.match(render({mutation:{status:'error',savedId:null,error:{message:'<script>unsafe</script>',requestId:'request-1'}}}),/&lt;script&gt;/)
  } finally {await server.close()}
})
