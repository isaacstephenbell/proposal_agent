'use client';

import { useState } from 'react';
import { CreateBlockRequest } from '@/lib/types';

interface BlockSaverProps {
  selectedText: string;
  onSave: (block: CreateBlockRequest) => void;
  onCancel: () => void;
  isVisible: boolean;
  authorId: string;
}

export default function BlockSaver({ 
  selectedText, 
  onSave, 
  onCancel, 
  isVisible, 
  authorId 
}: BlockSaverProps) {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a title for the block');
      return;
    }

    setIsLoading(true);
    try {
      await onSave({
        title: title.trim(),
        content: selectedText,
        tags,
        author_id: authorId,
        notes: notes.trim() || undefined
      });
      
      // Reset form
      setTitle('');
      setTags([]);
      setNotes('');
      setTagInput('');
    } catch (error) {
      console.error('Error saving block:', error);
      alert('Failed to save block. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Save as Reusable Block</h2>
        
        {/* Selected content preview */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content Preview
          </label>
          <div className="bg-gray-50 border rounded p-3 max-h-32 overflow-y-auto">
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {selectedText.length > 200 
                ? selectedText.substring(0, 200) + '...' 
                : selectedText}
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {selectedText.length} characters
          </p>
        </div>

        {/* Title input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Block Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Workforce Planning Methodology"
            maxLength={255}
          />
        </div>

        {/* Tags input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center"
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add tags (press Enter)"
            />
            <button
              onClick={handleAddTag}
              className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Add
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Add relevant tags like "methodology", "pricing", "timeline", etc.
          </p>
        </div>

        {/* Notes input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Add any context or notes about when to use this block..."
          />
        </div>

        {/* Action buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || !title.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save Block'}
          </button>
        </div>
      </div>
    </div>
  );
} 