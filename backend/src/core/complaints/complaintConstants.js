'use strict';

const CATEGORIES = Object.freeze(['equipment', 'electric', 'software', 'other']);
const PRIORITIES = Object.freeze(['low', 'medium', 'high', 'urgent']);
const STATUSES = Object.freeze(['open', 'acknowledged', 'in_progress', 'resolved', 'rejected']);

module.exports = {
  CATEGORIES,
  PRIORITIES,
  STATUSES
};
