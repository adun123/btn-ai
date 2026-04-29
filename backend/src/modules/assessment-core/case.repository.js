const { db } = require('../../data/memoryDb');

function saveCase(record) {
  db.cases.set(record.id, record);
  return record;
}

function findCaseById(caseId) {
  return db.cases.get(caseId) || null;
}

function listCases() {
  return Array.from(db.cases.values());
}

module.exports = {
  saveCase,
  findCaseById,
  listCases,
};
