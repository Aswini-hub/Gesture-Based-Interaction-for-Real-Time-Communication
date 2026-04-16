/**
 * Landing Page JavaScript
 * Gesture-Enhanced Online Meeting Platform - AirCanvas
 * 
 * Handles navigation and basic interactions for the landing page
 */

// Simple page initialization
document.addEventListener('DOMContentLoaded', () => {
  console.log('AirCanvas Landing Page Loaded');
  
  // Add smooth scroll behavior
  document.documentElement.style.scrollBehavior = 'smooth';
  
  // Optional: Add button click animations
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach(button => {
    button.addEventListener('click', (e) => {
      // Visual feedback
      button.style.transform = 'scale(0.98)';
      setTimeout(() => {
        button.style.transform = '';
      }, 100);
    });
  });
});
