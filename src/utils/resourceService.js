/**
 * RESOURCE SERVICE
 * 
 * Handles all data operations for the Learning Resource Library:
 * - Saving and retrieving cheat sheets, flashcard decks, mind maps
 * - Tracking access counts and favorites
 * - Progress statistics
 * 
 * Supports both:
 * - Authenticated users (Supabase)
 * - Guest users (localStorage fallback)
 */

import { supabase } from '../supabaseClient';

// ============================================
// CONSTANTS
// ============================================

// localStorage key for guest mode
const GUEST_RESOURCES_KEY = 'learning-resources';

// ============================================
// AUTH HELPERS
// ============================================

/**
 * Get current user and determine if guest mode
 * @returns {Object} { userId, isGuest }
 */
const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  // Check for guest mode
  const isGuestMode = localStorage.getItem('neural-guest-mode') === 'true';
  
  if (isGuestMode || !user) {
    return { userId: 'guest', isGuest: true };
  }
  
  return { userId: user.id, isGuest: false };
};

// ============================================
// GUEST MODE HELPERS
// ============================================

const getGuestResources = () => {
  try {
    const stored = localStorage.getItem(GUEST_RESOURCES_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveGuestResources = (resources) => {
  try {
    localStorage.setItem(GUEST_RESOURCES_KEY, JSON.stringify(resources));
  } catch (error) {
    console.error('Error saving guest resources:', error);
  }
};

const generateGuestId = () => `resource-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// ============================================
// RESOURCE OPERATIONS
// ============================================

/**
 * Save a resource to the library
 * For guests: Save to localStorage
 * For authenticated: Upsert to learning_resources table
 * 
 * @param {string} resourceType - 'cheatsheet' | 'flashcard_deck' | 'mindmap'
 * @param {string} subject - Subject area
 * @param {string} topic - Topic name
 * @param {string} title - Display title
 * @param {Object} content - Resource content (varies by type)
 * @returns {Promise} - Saved resource
 */
export const saveResource = async (resourceType, subject, topic, title, content) => {
  try {
    const { userId, isGuest } = await getCurrentUser();
    const key = `${resourceType}-${subject}-${topic}`;
    const now = new Date().toISOString();

    if (isGuest) {
      const resources = getGuestResources();
      const existingResource = Object.values(resources).find(
        r => r.resourceType === resourceType && r.subject === subject && r.topic === topic
      );
      
      const resource = {
        id: existingResource?.id || generateGuestId(),
        resourceType,
        subject,
        topic,
        title,
        content,
        createdAt: existingResource?.createdAt || now,
        updatedAt: now,
        lastAccessed: now,
        accessCount: (existingResource?.accessCount || 0) + 1,
        isFavorite: existingResource?.isFavorite || false,
      };
      
      resources[resource.id] = resource;
      saveGuestResources(resources);
      
      return { success: true, data: resource };
    }

    // Supabase upsert for authenticated users
    const { data, error } = await supabase
      .from('learning_resources')
      .upsert({
        user_id: userId,
        resource_type: resourceType,
        subject,
        topic,
        title,
        content,
        updated_at: now,
        last_accessed: now,
      }, { onConflict: 'user_id,resource_type,subject,topic' })
      .select()
      .single();

    if (error) throw error;
    
    return { 
      success: true, 
      data: {
        id: data.id,
        resourceType: data.resource_type,
        subject: data.subject,
        topic: data.topic,
        title: data.title,
        content: data.content,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        lastAccessed: data.last_accessed,
        accessCount: data.access_count,
        isFavorite: data.is_favorite,
      }
    };
  } catch (error) {
    console.error('Error saving resource:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get a specific resource
 * Updates last_accessed and increments access_count
 * 
 * @param {string} resourceType - 'cheatsheet' | 'flashcard_deck' | 'mindmap'
 * @param {string} subject - Subject area
 * @param {string} topic - Topic name
 * @returns {Promise} - Resource or null if not found
 */
export const getResource = async (resourceType, subject, topic) => {
  try {
    const { userId, isGuest } = await getCurrentUser();
    const now = new Date().toISOString();

    if (isGuest) {
      const resources = getGuestResources();
      const resource = Object.values(resources).find(
        r => r.resourceType === resourceType && r.subject === subject && r.topic === topic
      );
      
      if (!resource) {
        return { success: true, data: null };
      }
      
      // Update access tracking
      resource.lastAccessed = now;
      resource.accessCount = (resource.accessCount || 0) + 1;
      resources[resource.id] = resource;
      saveGuestResources(resources);
      
      return { success: true, data: resource };
    }

    // Supabase for authenticated users
    const { data, error } = await supabase
      .from('learning_resources')
      .select('*')
      .eq('user_id', userId)
      .eq('resource_type', resourceType)
      .eq('subject', subject)
      .eq('topic', topic)
      .single();

    if (error && error.code === 'PGRST116') {
      // No resource found
      return { success: true, data: null };
    }

    if (error) throw error;

    // Update access tracking
    await supabase
      .from('learning_resources')
      .update({
        last_accessed: now,
        access_count: (data.access_count || 0) + 1,
      })
      .eq('id', data.id);

    return { 
      success: true, 
      data: {
        id: data.id,
        resourceType: data.resource_type,
        subject: data.subject,
        topic: data.topic,
        title: data.title,
        content: data.content,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        lastAccessed: data.last_accessed,
        accessCount: data.access_count,
        isFavorite: data.is_favorite,
      }
    };
  } catch (error) {
    console.error('Error getting resource:', error);
    return { success: false, error: error.message, data: null };
  }
};

/**
 * Get all resources for current user
 * 
 * @param {Object} filters - Optional filters
 * @param {string} filters.resourceType - Filter by type
 * @param {string} filters.subject - Filter by subject
 * @param {boolean} filters.favoriteOnly - Only favorites
 * @returns {Promise} - Array of resources sorted by last_accessed (most recent first)
 */
export const getAllResources = async (filters = {}) => {
  try {
    const { userId, isGuest } = await getCurrentUser();

    if (isGuest) {
      const resources = getGuestResources();
      let resourceList = Object.values(resources);
      
      // Apply filters
      if (filters.resourceType) {
        resourceList = resourceList.filter(r => r.resourceType === filters.resourceType);
      }
      if (filters.subject) {
        resourceList = resourceList.filter(r => r.subject === filters.subject);
      }
      if (filters.favoriteOnly) {
        resourceList = resourceList.filter(r => r.isFavorite);
      }
      
      // Sort by last accessed (most recent first)
      resourceList.sort((a, b) => 
        new Date(b.lastAccessed || b.createdAt) - new Date(a.lastAccessed || a.createdAt)
      );
      
      return { success: true, data: resourceList };
    }

    // Supabase for authenticated users
    let query = supabase
      .from('learning_resources')
      .select('*')
      .eq('user_id', userId);

    if (filters.resourceType) {
      query = query.eq('resource_type', filters.resourceType);
    }
    if (filters.subject) {
      query = query.eq('subject', filters.subject);
    }
    if (filters.favoriteOnly) {
      query = query.eq('is_favorite', true);
    }

    query = query.order('last_accessed', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    const resourceList = (data || []).map(item => ({
      id: item.id,
      resourceType: item.resource_type,
      subject: item.subject,
      topic: item.topic,
      title: item.title,
      content: item.content,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      lastAccessed: item.last_accessed,
      accessCount: item.access_count,
      isFavorite: item.is_favorite,
    }));

    return { success: true, data: resourceList };
  } catch (error) {
    console.error('Error getting all resources:', error);
    return { success: false, error: error.message, data: [] };
  }
};

/**
 * Delete a resource by ID
 * 
 * @param {string} resourceId - Resource ID
 * @returns {Promise} - Success status
 */
export const deleteResource = async (resourceId) => {
  try {
    const { userId, isGuest } = await getCurrentUser();

    if (isGuest) {
      const resources = getGuestResources();
      delete resources[resourceId];
      saveGuestResources(resources);
      return { success: true };
    }

    // Supabase for authenticated users
    const { error } = await supabase
      .from('learning_resources')
      .delete()
      .eq('id', resourceId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting resource:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Toggle favorite status of a resource
 * 
 * @param {string} resourceId - Resource ID
 * @returns {Promise} - Updated resource
 */
export const toggleFavorite = async (resourceId) => {
  try {
    const { userId, isGuest } = await getCurrentUser();

    if (isGuest) {
      const resources = getGuestResources();
      const resource = resources[resourceId];
      
      if (!resource) {
        return { success: false, error: 'Resource not found' };
      }
      
      resource.isFavorite = !resource.isFavorite;
      resources[resourceId] = resource;
      saveGuestResources(resources);
      
      return { success: true, data: resource };
    }

    // Get current state first
    const { data: current, error: fetchError } = await supabase
      .from('learning_resources')
      .select('is_favorite')
      .eq('id', resourceId)
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;

    // Toggle and update
    const { data, error } = await supabase
      .from('learning_resources')
      .update({ is_favorite: !current.is_favorite })
      .eq('id', resourceId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return { 
      success: true, 
      data: {
        id: data.id,
        resourceType: data.resource_type,
        subject: data.subject,
        topic: data.topic,
        title: data.title,
        content: data.content,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        lastAccessed: data.last_accessed,
        accessCount: data.access_count,
        isFavorite: data.is_favorite,
      }
    };
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get resource statistics (counts by type)
 * 
 * @returns {Promise} - { cheatsheets: number, flashcard_decks: number, mindmaps: number }
 */
export const getResourceStats = async () => {
  try {
    const { userId, isGuest } = await getCurrentUser();

    const defaultStats = {
      cheatsheets: 0,
      flashcard_decks: 0,
      mindmaps: 0,
    };

    if (isGuest) {
      const resources = getGuestResources();
      const resourceList = Object.values(resources);
      
      return {
        success: true,
        data: {
          cheatsheets: resourceList.filter(r => r.resourceType === 'cheatsheet').length,
          flashcard_decks: resourceList.filter(r => r.resourceType === 'flashcard_deck').length,
          mindmaps: resourceList.filter(r => r.resourceType === 'mindmap').length,
        }
      };
    }

    // Supabase for authenticated users - count by type
    const { data, error } = await supabase
      .from('learning_resources')
      .select('resource_type')
      .eq('user_id', userId);

    if (error) throw error;

    const stats = { ...defaultStats };
    (data || []).forEach(item => {
      if (item.resource_type === 'cheatsheet') stats.cheatsheets++;
      else if (item.resource_type === 'flashcard_deck') stats.flashcard_decks++;
      else if (item.resource_type === 'mindmap') stats.mindmaps++;
    });

    return { success: true, data: stats };
  } catch (error) {
    console.error('Error getting resource stats:', error);
    return { success: false, error: error.message, data: { cheatsheets: 0, flashcard_decks: 0, mindmaps: 0 } };
  }
};

// ============================================
// MIGRATION: Guest to Authenticated
// ============================================

/**
 * Migrate guest resource data to authenticated user's Supabase account
 */
export const migrateGuestResourcesToSupabase = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'No authenticated user' };
    }

    const migrationKey = `resources-migrated-${user.id}`;
    if (localStorage.getItem(migrationKey)) {
      return { success: true, alreadyMigrated: true };
    }

    const guestResources = getGuestResources();
    const resourceList = Object.values(guestResources);
    
    if (resourceList.length === 0) {
      localStorage.setItem(migrationKey, new Date().toISOString());
      return { success: true, migrated: 0 };
    }

    let migratedCount = 0;

    for (const resource of resourceList) {
      const { error } = await supabase
        .from('learning_resources')
        .upsert({
          user_id: user.id,
          resource_type: resource.resourceType,
          subject: resource.subject,
          topic: resource.topic,
          title: resource.title,
          content: resource.content,
          created_at: resource.createdAt,
          updated_at: resource.updatedAt,
          last_accessed: resource.lastAccessed,
          access_count: resource.accessCount || 1,
          is_favorite: resource.isFavorite || false,
        }, { onConflict: 'user_id,resource_type,subject,topic' });

      if (!error) {
        migratedCount++;
      }
    }

    // Mark as migrated
    localStorage.setItem(migrationKey, new Date().toISOString());

    // Clear guest data after successful migration
    localStorage.removeItem(GUEST_RESOURCES_KEY);

    return { success: true, migrated: migratedCount };
  } catch (error) {
    console.error('Error migrating guest resources:', error);
    return { success: false, error: error.message };
  }
};
