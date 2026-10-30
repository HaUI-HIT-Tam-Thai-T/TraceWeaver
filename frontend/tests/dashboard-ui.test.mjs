import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'
test('dashboard UI renders four zero counters, exact semantics, waiting disclosure and labelled UTC+7 form',async()=>{
 const server=await createServer({configFile:false,cacheDir:'node_modules/.tmp/ssr-dashboard',server:{middlewareMode:true,hmr:false,ws:false}})
 try {
 const {DashboardTimeForm,DashboardCounters}=await server.ssrLoadModule('/src/features/dashboard/components/DashboardView.tsx')
 const counters=renderToString(createElement(DashboardCounters,{data:{runs:0,degraded_runs:0,unresolved_events:0,waiting_cases:0,filters:{}},waiting:false,showWaiting(){}}))
 assert.equal((counters.match(/<dd[^>]*>0<\/dd>/g)??[]).length,4);assert.equal((counters.match(/data-slot="card"/g)??[]).length,4);assert.match(counters,/aria-expanded="false"/);assert.match(counters,/Mới và Đã phân công/);assert.match(counters,/đếm theo từng lần tái dựng hoàn tất/)
 const form=renderToString(createElement(DashboardTimeForm,{filters:{},apply(){}}));assert.match(form,/ngày tạo lần tái dựng/);assert.match(form,/UTC\+7/);assert.equal((form.match(/type="datetime-local"/g)??[]).length,2);assert.match(form,/Áp dụng/)
 }finally{await server.close()}
})
