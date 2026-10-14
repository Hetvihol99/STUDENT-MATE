import test from "node:test";
import assert from "node:assert/strict";
import {selectPractice} from "../lib/practice-selection.ts";
const materials = [
  {id:"other",course:"DBMS",status:"Ready to study",seeded:false},
  {id:"sample",course:"DBMS",status:"Ready to study",seeded:true},
  {id:"failed",course:"DBMS",status:"Processing failed"},
  {id:"math",course:"Math",status:"Ready to study",seeded:false},
];
const topics = [{id:"keys",materialId:"sample"},{id:"notes",materialId:"other"}];
test("targeted practice uses the target's material even when another upload appears first", () => {
  assert.deepEqual(selectPractice(topics,materials,"DBMS","keys"),{materialId:"sample",topic:"keys",source:"prepared"});
});
test("custom-material practice selects AI and keeps the requested topic", () => {
  assert.deepEqual(selectPractice(topics,materials,"DBMS","notes"),{materialId:"other",topic:"notes",source:"ai"});
});
test("course changes and deleted targets cannot retain an out-of-scope topic", () => {
  assert.deepEqual(selectPractice(topics,materials,"Math","keys"),{materialId:"math",topic:"all",source:"ai"});
  assert.equal(selectPractice(topics,materials.filter(m=>m.id!=="sample"),"DBMS","keys").topic,"all");
  assert.equal(selectPractice(topics,materials,"Empty","keys").materialId,"");
});
