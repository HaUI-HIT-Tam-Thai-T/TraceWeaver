import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'
import { graph } from './reconstruction-fixtures.mjs'

test('link editor has labeled review/manual forms, readonly guard, locks and safe feedback',async()=>{
  const server=await createServer({configFile:false,cacheDir:'node_modules/.tmp/ssr-link-review',server:{middlewareMode:true,hmr:false,ws:false}})
  try {
    const {LinkReviewPanel}=await server.ssrLoadModule('/src/features/link-review/LinkReviewPanel.tsx')
    const actions={reviewLink:async()=>{},createManualLink:async()=>{},probeClosedCase(){}}
    const render=(patch={})=>renderToString(createElement(LinkReviewPanel,{graph:graph(),graphReady:true,mutation:{status:'idle',error:null,linkId:null},caseLocked:false,canWrite:true,actions,...patch})).replace(/<!--.*?-->/g,'')
    const html=render()
    for(const text of ['Link cần duyệt','Quyết định','Lý do review','Event nguồn','Event đích','Lý do manual link','manual/pending'])assert.ok(html.includes(text))
    assert.equal(render({canWrite:false}),'')
    assert.match(render({graphReady:false}),/fieldset disabled/)
    assert.match(render({caseLocked:true}),/Thử chỉnh sửa lại/)
    for(const [status,text] of [['uncertain','không tự gửi lại POST'],['success','Đã ghi thao tác'],['conflict','Link.version'],['duplicate','Cạnh cùng hướng']])assert.ok(render({mutation:{status,error:null,linkId:null}}).includes(text))
    const error={code:'LINK_CYCLE',message:'safe',requestId:'request-demo'}
    assert.match(render({mutation:{status:'error',error,linkId:null}}),/chu trình/)
    assert.match(render({mutation:{status:'error',error:{code:'ERR',message:'<script>unsafe</script>',requestId:null},linkId:null}}),/&lt;script&gt;/)
  } finally {await server.close()}
})
