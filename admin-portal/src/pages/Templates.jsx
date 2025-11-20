import { useEffect, useState } from 'react';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from '../api/client';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, ClockIcon } from '@heroicons/react/24/outline';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SCHEDULE_TYPES = [
  { value: 'enforced', label: 'Enforced (Paid)', color: 'bg-red-100 text-red-800', bgColor: 'bg-red-300', borderColor: 'border-red-400' },
  { value: 'enforced_unpaid', label: 'Enforced (Unpaid)', color: 'bg-orange-100 text-orange-800', bgColor: 'bg-orange-300', borderColor: 'border-orange-400' },
  { value: 'no_parking', label: 'No Parking', color: 'bg-purple-100 text-purple-800', bgColor: 'bg-purple-400', borderColor: 'border-purple-500' },
  { value: 'no_stopping', label: 'No Stopping', color: 'bg-pink-100 text-pink-800', bgColor: 'bg-pink-400', borderColor: 'border-pink-500' },
  { value: 'free', label: 'Free Parking', color: 'bg-green-100 text-green-800', bgColor: 'bg-green-300', borderColor: 'border-green-400' },
  { value: 'unenforced', label: 'Unenforced', color: 'bg-gray-100 text-gray-800', bgColor: 'bg-gray-200', borderColor: 'border-gray-300' },
];

// Format time string to HH:MM (handles both HH:MM:SS and ISO formats)
const formatTime = (timeString) => {
  if (!timeString) return '';
  // If it's an ISO timestamp, extract the time part
  if (timeString.includes('T')) {
    const date = new Date(timeString);
    return date.toTimeString().slice(0, 5); // Get HH:MM
  }
  // If it's already HH:MM:SS, just take HH:MM
  return timeString.slice(0, 5);
};

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    spot_type: 'street',
    duration_estimate: '',
    notes: '',
    schedules: [],
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await getTemplates();
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setMessage({ type: 'error', text: 'Failed to load templates' });
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      spot_type: 'street',
      duration_estimate: '',
      notes: '',
      schedules: [],
    });
    setShowModal(true);
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name || '',
      description: template.description || '',
      spot_type: template.spot_type || 'street',
      duration_estimate: template.duration_estimate || '',
      notes: template.notes || '',
      schedules: template.schedules || [],
    });
    setShowModal(true);
  };

  const handleDelete = async (template) => {
    if (!confirm(`Delete template "${template.name}"?`)) return;

    try {
      await deleteTemplate(template.id);
      setMessage({ type: 'success', text: 'Template deleted successfully' });
      await loadTemplates();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to delete template' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const data = {
        name: formData.name,
        description: formData.description || null,
        spot_type: formData.spot_type || null,
        duration_estimate: formData.duration_estimate ? parseInt(formData.duration_estimate) : null,
        notes: formData.notes || null,
        schedules: formData.schedules.map(({ all_day, ...schedule }) => schedule), // Remove all_day field
      };

      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, data);
        setMessage({ type: 'success', text: 'Template updated successfully' });
      } else {
        await createTemplate(data);
        setMessage({ type: 'success', text: 'Template created successfully' });
      }

      setShowModal(false);
      await loadTemplates();
    } catch (error) {
      console.error('Submit error:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save template' });
    }
  };

  const addSchedule = (dayOfWeek = 1) => {
    setFormData({
      ...formData,
      schedules: [
        ...formData.schedules,
        {
          day_of_week: dayOfWeek,
          start_time: '08:00:00',
          end_time: '18:00:00',
          schedule_type: 'enforced',
          description: '',
          all_day: false,
        },
      ],
    });
  };

  const updateSchedule = (index, field, value) => {
    const newSchedules = [...formData.schedules];
    
    // If toggling all_day, update times accordingly
    if (field === 'all_day') {
      newSchedules[index] = {
        ...newSchedules[index],
        all_day: value,
        start_time: value ? '00:00:00' : '08:00:00',
        end_time: value ? '23:59:59' : '18:00:00',
      };
    } else {
      newSchedules[index] = { ...newSchedules[index], [field]: value };
    }
    
    setFormData({ ...formData, schedules: newSchedules });
  };

  const removeSchedule = (index) => {
    setFormData({
      ...formData,
      schedules: formData.schedules.filter((_, i) => i !== index),
    });
  };

  const getScheduleTypeColor = (type) => {
    return SCHEDULE_TYPES.find(t => t.value === type)?.color || 'bg-gray-100 text-gray-800';
  };

  // Get background color for grid cells (lighter version for visualization)
  const getScheduleTypeBgColor = (type) => {
    return SCHEDULE_TYPES.find(t => t.value === type)?.bgColor || 'bg-gray-100';
  };

  // Get border color for legend
  const getScheduleTypeBorderColor = (type) => {
    return SCHEDULE_TYPES.find(t => t.value === type)?.borderColor || 'border-gray-300';
  };

  // Function to get schedule type for a specific day and time
  const getScheduleTypeAtTime = (dayOfWeek, hour, minute) => {
    const timeInMinutes = hour * 60 + minute;
    
    // Find matching schedule for this day and time
    const matchingSchedule = formData.schedules.find(schedule => {
      if (schedule.day_of_week !== dayOfWeek) return false;
      
      const [startHour, startMin] = schedule.start_time.split(':').map(Number);
      const [endHour, endMin] = schedule.end_time.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      return timeInMinutes >= startMinutes && timeInMinutes < endMinutes;
    });
    
    return matchingSchedule ? matchingSchedule.schedule_type : 'unenforced';
  };

  if (loading) {
    return <div className="text-center py-12">Loading templates...</div>;
  }

  return (
    <div>
      {message.text && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Parking Spot Templates</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Total: {templates.length}</span>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Add Template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <div key={template.id} className="bg-white rounded-lg shadow p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                {template.description && (
                  <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                )}
              </div>
              <div className="flex gap-2 ml-2">
                <button
                  onClick={() => handleEdit(template)}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                  title="Edit"
                >
                  <PencilIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(template)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                  title="Delete"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium text-gray-900">{template.spot_type || 'N/A'}</span>
              </div>
              {template.duration_estimate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium text-gray-900">{template.duration_estimate} min</span>
                </div>
              )}
            </div>

            {template.schedules && template.schedules.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <ClockIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-xs font-semibold text-gray-700">
                    {template.schedules.length} Schedule{template.schedules.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-1">
                  {template.schedules.slice(0, 3).map((schedule, idx) => (
                    <div key={idx} className="text-xs">
                      <span className="font-medium text-gray-700">{DAY_NAMES[schedule.day_of_week]}:</span>
                      <span className="ml-1 text-gray-600">
                        {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                      </span>
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${getScheduleTypeColor(schedule.schedule_type)}`}>
                        {SCHEDULE_TYPES.find(t => t.value === schedule.schedule_type)?.label}
                      </span>
                    </div>
                  ))}
                  {template.schedules.length > 3 && (
                    <p className="text-xs text-gray-500 italic">+{template.schedules.length - 3} more</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal for Create/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Standard Street Parking"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Brief description of this template"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Spot Type
                    </label>
                    <select
                      value={formData.spot_type}
                      onChange={(e) => setFormData({ ...formData, spot_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="street">Street</option>
                      <option value="garage">Garage</option>
                      <option value="lot">Lot</option>
                      <option value="private">Private</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration Estimate (minutes)
                    </label>
                    <input
                      type="number"
                      value={formData.duration_estimate}
                      onChange={(e) => setFormData({ ...formData, duration_estimate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="120"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Additional notes about this template..."
                  />
                </div>
              </div>

              {/* Visual Schedule Grid */}
              <div className="space-y-4 border-t border-gray-200 pt-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Weekly Schedule Visualization</h3>
                  <p className="text-sm text-gray-600 mt-1">30-minute intervals showing enforcement type by time of day</p>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  {SCHEDULE_TYPES.map((type) => (
                    <div key={type.value} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded ${getScheduleTypeBgColor(type.value)} border border-gray-300`}></div>
                      <span className="text-xs font-medium text-gray-700">{type.label}</span>
                    </div>
                  ))}
                </div>

                {/* Schedule Grid */}
                <div className="overflow-x-auto border border-gray-300 rounded-lg">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="sticky left-0 bg-gray-100 px-2 py-2 text-left font-semibold text-gray-700 border-r border-gray-300 w-20">
                          Time
                        </th>
                        {DAY_NAMES.map((day, idx) => (
                          <th key={idx} className="px-1 py-2 font-semibold text-gray-700 border-r border-gray-300 min-w-[60px]">
                            {day.substring(0, 3)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 48 }, (_, i) => {
                        const hour = Math.floor(i / 2);
                        const minute = (i % 2) * 30;
                        const timeLabel = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                        
                        return (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="sticky left-0 bg-white px-2 py-1 text-gray-600 border-r border-gray-300 text-xs font-mono">
                              {timeLabel}
                            </td>
                            {DAY_NAMES.map((_, dayIdx) => {
                              const scheduleType = getScheduleTypeAtTime(dayIdx, hour, minute);
                              return (
                                <td
                                  key={dayIdx}
                                  className={`border-r border-gray-200 ${getScheduleTypeBgColor(scheduleType)}`}
                                  title={`${DAY_NAMES[dayIdx]} ${timeLabel}: ${SCHEDULE_TYPES.find(t => t.value === scheduleType)?.label}`}
                                >
                                  <div className="h-6"></div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Schedules */}
              <div className="space-y-4 border-t border-gray-200 pt-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Enforcement Schedules</h3>
                    <p className="text-sm text-gray-600 mt-1">Define time ranges for each day. Defaults to unenforced all day.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Always show all 7 days */}
                  {DAY_NAMES.map((dayName, dayIndex) => {
                    // Get schedules for this day
                    const daySchedules = formData.schedules
                      .map((schedule, idx) => ({ ...schedule, originalIndex: idx }))
                      .filter(schedule => schedule.day_of_week === dayIndex);
                    
                    // Default schedule if none exist
                    const hasSchedules = daySchedules.length > 0;

                    return (
                      <div key={dayIndex} className="border border-gray-300 rounded-lg overflow-hidden">
                        <div className="bg-blue-50 px-4 py-2 border-b border-gray-300 flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold text-gray-900">{dayName}</h4>
                            <p className="text-xs text-gray-600">
                              {hasSchedules ? `${daySchedules.length} time range${daySchedules.length !== 1 ? 's' : ''}` : 'Unenforced all day (default)'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addSchedule(dayIndex)}
                            className="flex items-center gap-1 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          >
                            <PlusIcon className="w-3 h-3" />
                            Add Schedule
                          </button>
                        </div>
                        
                        {hasSchedules && (
                          <div className="p-3 space-y-3 bg-white">
                            {daySchedules.map((schedule) => {
                              const index = schedule.originalIndex;
                              return (
                                <div key={index} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                                  <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${getScheduleTypeColor(schedule.schedule_type)}`}>
                                        {SCHEDULE_TYPES.find(t => t.value === schedule.schedule_type)?.label}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removeSchedule(index)}
                                      className="text-red-600 hover:text-red-700"
                                      title="Remove schedule"
                                    >
                                      <TrashIcon className="w-4 h-4" />
                                    </button>
                                  </div>
                                  
                                  <div className="grid grid-cols-3 gap-3">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
                                      <input
                                        type="time"
                                        value={schedule.start_time?.substring(0, 5) || '08:00'}
                                        onChange={(e) => updateSchedule(index, 'start_time', e.target.value + ':00')}
                                        disabled={schedule.all_day}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
                                      <input
                                        type="time"
                                        value={schedule.end_time?.substring(0, 5) || '18:00'}
                                        onChange={(e) => updateSchedule(index, 'end_time', e.target.value + ':00')}
                                        disabled={schedule.all_day}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                                      <select
                                        value={schedule.schedule_type}
                                        onChange={(e) => updateSchedule(index, 'schedule_type', e.target.value)}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                      >
                                        {SCHEDULE_TYPES.map((type) => (
                                          <option key={type.value} value={type.value}>{type.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  <div className="mt-3 flex items-center">
                                    <input
                                      type="checkbox"
                                      id={`all-day-${index}`}
                                      checked={schedule.all_day || false}
                                      onChange={(e) => updateSchedule(index, 'all_day', e.target.checked)}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <label htmlFor={`all-day-${index}`} className="ml-2 text-sm text-gray-700">
                                      All Day (00:00 - 23:59)
                                    </label>
                                  </div>

                                  <div className="mt-3">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                                    <input
                                      type="text"
                                      value={schedule.description || ''}
                                      onChange={(e) => updateSchedule(index, 'description', e.target.value)}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                      placeholder="Optional description"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
