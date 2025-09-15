import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Search, Calendar, Filter } from 'lucide-react';

// Types
type TaskCategory = 'To Do' | 'In Progress' | 'Review' | 'Completed';
type TimeFilter = 'all' | '1' | '2' | '3';

interface Task {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  category: TaskCategory;
}

interface DragState {
  isDragging: boolean;
  isResizing: boolean;
  resizeType: 'start' | 'end' | null;
  taskId: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface CreateTaskState {
  isSelecting: boolean;
  startDate: string | null;
  currentDate: string | null;
}

interface ModalTaskState {
  name: string;
  category: TaskCategory;
  startDate: string;
  endDate: string;
}

const TaskPlanner: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilters, setCategoryFilters] = useState<TaskCategory[]>(['To Do', 'In Progress', 'Review', 'Completed']);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [showModal, setShowModal] = useState(false);
  const [modalTask, setModalTask] = useState<ModalTaskState>({ name: '', category: 'To Do', startDate: '', endDate: '' });
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    isResizing: false,
    resizeType: null,
    taskId: null,
    startDate: null,
    endDate: null
  });
  const [createTaskState, setCreateTaskState] = useState<CreateTaskState>({
    isSelecting: false,
    startDate: null,
    currentDate: null
  });

  const calendarRef = useRef<HTMLDivElement>(null);

  // Date utilities
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  const getDaysInMonth = (date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: Date[] = [];
    const current = new Date(startDate);
    
    while (days.length < 42) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const isDateInRange = (date: string, start: string, end: string): boolean => {
    return date >= start && date <= end;
  };

  // Filter tasks based on current filters
  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter(task => 
      categoryFilters.includes(task.category) &&
      task.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (timeFilter !== 'all') {
      const today = new Date();
      const weeks = parseInt(timeFilter);
      const futureDate = addDays(today, weeks * 7);
      const todayStr = formatDate(today);
      const futureDateStr = formatDate(futureDate);
      
      filtered = filtered.filter(task => 
        task.startDate <= futureDateStr && task.endDate >= todayStr
      );
    }

    return filtered;
  }, [tasks, categoryFilters, searchTerm, timeFilter]);

  // Task creation handlers
  const handleMouseDown = (e: React.MouseEvent, dateStr: string) => {
    if (e.target === e.currentTarget) {
      e.preventDefault();
      setCreateTaskState({
        isSelecting: true,
        startDate: dateStr,
        currentDate: dateStr
      });
    }
  };

  const handleMouseEnter = (dateStr: string) => {
    if (createTaskState.isSelecting && createTaskState.startDate) {
      setCreateTaskState(prev => ({ ...prev, currentDate: dateStr }));
    }
  };

  const handleMouseUp = () => {
    if (createTaskState.isSelecting && createTaskState.startDate && createTaskState.currentDate) {
      const start = createTaskState.startDate <= createTaskState.currentDate ? 
        createTaskState.startDate : createTaskState.currentDate;
      const end = createTaskState.startDate <= createTaskState.currentDate ? 
        createTaskState.currentDate : createTaskState.startDate;
      
      setModalTask({
        name: '',
        category: 'To Do',
        startDate: start,
        endDate: end
      });
      setShowModal(true);
    }
    setCreateTaskState({ isSelecting: false, startDate: null, currentDate: null });
  };

  // Task manipulation handlers
  const handleTaskMouseDown = (e: React.MouseEvent, taskId: string, task: Task) => {
    e.stopPropagation();
    e.preventDefault();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    
    let resizeType: 'start' | 'end' | null = null;
    if (clickX < 10) resizeType = 'start';
    else if (clickX > width - 10) resizeType = 'end';
    
    setDragState({
      isDragging: !resizeType,
      isResizing: !!resizeType,
      resizeType,
      taskId,
      startDate: task.startDate,
      endDate: task.endDate
    });
  };

  const handleTaskDrag = (e: React.MouseEvent) => {
    if (!dragState.isDragging && !dragState.isResizing) return;
    
    const element = document.elementFromPoint(e.clientX, e.clientY);
    const dayTile = element?.closest('[data-date]');
    const targetDate = dayTile?.getAttribute('data-date');
    
    if (targetDate && dragState.taskId) {
      const task = tasks.find(t => t.id === dragState.taskId);
      if (!task) return;

      if (dragState.isDragging) {
        // Move task
        const taskDuration = new Date(task.endDate).getTime() - new Date(task.startDate).getTime();
        const newEndDate = new Date(new Date(targetDate).getTime() + taskDuration);
        
        setDragState(prev => ({
          ...prev,
          startDate: targetDate,
          endDate: formatDate(newEndDate)
        }));
      } else if (dragState.isResizing) {
        // Resize task
        if (dragState.resizeType === 'start') {
          if (targetDate <= task.endDate) {
            setDragState(prev => ({ ...prev, startDate: targetDate }));
          }
        } else if (dragState.resizeType === 'end') {
          if (targetDate >= task.startDate) {
            setDragState(prev => ({ ...prev, endDate: targetDate }));
          }
        }
      }
    }
  };

  const handleTaskDragEnd = () => {
    if (dragState.taskId && (dragState.startDate || dragState.endDate)) {
      setTasks(prev => prev.map(task => 
        task.id === dragState.taskId 
          ? { 
              ...task, 
              startDate: dragState.startDate || task.startDate,
              endDate: dragState.endDate || task.endDate
            }
          : task
      ));
    }
    
    setDragState({
      isDragging: false,
      isResizing: false,
      resizeType: null,
      taskId: null,
      startDate: null,
      endDate: null
    });
  };

  const createTask = () => {
    if (modalTask.name.trim()) {
      const newTask: Task = {
        id: Date.now().toString(),
        name: modalTask.name.trim(),
        startDate: modalTask.startDate,
        endDate: modalTask.endDate,
        category: modalTask.category
      };
      setTasks(prev => [...prev, newTask]);
      setShowModal(false);
      setModalTask({ name: '', category: 'To Do', startDate: '', endDate: '' });
    }
  };

  // Get tasks for a specific date
  const getTasksForDate = (dateStr: string): Task[] => {
    return filteredTasks.filter(task => isDateInRange(dateStr, task.startDate, task.endDate));
  };

  // Get selection range for task creation
  const getSelectionRange = (): string[] => {
    if (!createTaskState.isSelecting || !createTaskState.startDate || !createTaskState.currentDate) {
      return [];
    }
    
    const start = createTaskState.startDate <= createTaskState.currentDate ? 
      createTaskState.startDate : createTaskState.currentDate;
    const end = createTaskState.startDate <= createTaskState.currentDate ? 
      createTaskState.currentDate : createTaskState.startDate;
    
    const range: string[] = [];
    const current = new Date(start);
    const endDate = new Date(end);
    
    while (current <= endDate) {
      range.push(formatDate(current));
      current.setDate(current.getDate() + 1);
    }
    
    return range;
  };

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const selectionRange = getSelectionRange();

  const categoryColors: Record<TaskCategory, string> = {
    'To Do': 'bg-blue-500',
    'In Progress': 'bg-yellow-500',
    'Review': 'bg-purple-500',
    'Completed': 'bg-green-500'
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Task Planner</h1>
          
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex flex-wrap gap-4">
              {/* Search */}
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              {/* Category Filters */}
              <div className="flex flex-wrap gap-2">
                {(['To Do', 'In Progress', 'Review', 'Completed'] as TaskCategory[]).map(category => (
                  <label key={category} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={categoryFilters.includes(category)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCategoryFilters(prev => [...prev, category]);
                        } else {
                          setCategoryFilters(prev => prev.filter(c => c !== category));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">{category}</span>
                  </label>
                ))}
              </div>
              
              {/* Time Filter */}
              <div className="flex gap-2">
                {[
                  { value: 'all' as const, label: 'All Tasks' },
                  { value: '1' as const, label: '1 Week' },
                  { value: '2' as const, label: '2 Weeks' },
                  { value: '3' as const, label: '3 Weeks' }
                ].map(option => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="timeFilter"
                      value={option.value}
                      checked={timeFilter === option.value}
                      onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                      className="border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-lg shadow-sm">
          {/* Calendar Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">{monthName}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                  className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md"
                >
                  Today
                </button>
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                  className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-3 text-center text-sm font-medium text-gray-500 bg-gray-50">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div 
            ref={calendarRef}
            className="grid grid-cols-7"
            onMouseMove={handleTaskDrag}
            onMouseUp={() => {
              handleMouseUp();
              handleTaskDragEnd();
            }}
            onMouseLeave={() => {
              handleMouseUp();
              handleTaskDragEnd();
            }}
          >
            {days.map((day, index) => {
              const dateStr = formatDate(day);
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = formatDate(day) === formatDate(new Date());
              const isSelected = selectionRange.includes(dateStr);
              const dayTasks = getTasksForDate(dateStr);

              return (
                <div
                  key={index}
                  data-date={dateStr}
                  className={`min-h-32 border-r border-b border-gray-200 p-2 relative cursor-pointer select-none ${
                    !isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'
                  } ${isToday ? 'bg-blue-50' : ''} ${isSelected ? 'bg-blue-100' : ''}`}
                  onMouseDown={(e) => handleMouseDown(e, dateStr)}
                  onMouseEnter={() => handleMouseEnter(dateStr)}
                  style={{
                    // Ensure tasks can flow seamlessly between cells
                    overflow: 'visible'
                  }}
                >
                  <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : ''}`}>
                    {day.getDate()}
                  </div>
                  
                  {/* Tasks */}
                  <div className="space-y-1">
                    {dayTasks.map((task, taskIndex) => {
                      const isFirstDay = task.startDate === dateStr;
                      const isLastDay = task.endDate === dateStr;
                      const isMiddleDay = !isFirstDay && !isLastDay;
                      const isDraggedTask = dragState.taskId === task.id;
                      
                      // Determine border radius based on position in task span
                      let roundedClass = '';
                      if (isFirstDay && isLastDay) {
                        roundedClass = 'rounded'; // Single day task
                      } else if (isFirstDay) {
                        roundedClass = 'rounded-l'; // First day of multi-day task
                      } else if (isLastDay) {
                        roundedClass = 'rounded-r'; // Last day of multi-day task
                      } else {
                        roundedClass = ''; // Middle day of multi-day task (no rounding)
                      }
                      
                      return (
                        <div
                          key={`${task.id}-${taskIndex}`}
                          className={`text-xs px-2 py-1 text-white cursor-move relative group ${
                            categoryColors[task.category]
                          } ${roundedClass} ${isDraggedTask ? 'opacity-50' : ''}`}
                          onMouseDown={(e) => handleTaskMouseDown(e, task.id, task)}
                          style={{
                            cursor: dragState.isResizing ? 'ew-resize' : 'move',
                            // Remove margin on sides for continuous appearance
                            marginLeft: isFirstDay ? 0 : '-1px',
                            marginRight: isLastDay ? 0 : '-1px'
                          }}
                        >
                          {/* Resize handle for start */}
                          {isFirstDay && (
                            <div className="absolute left-0 top-0 w-2 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white bg-opacity-30 rounded-l"></div>
                          )}
                          
                          {/* Task name only shows on first day */}
                          {isFirstDay ? (
                            <span className="truncate block">{task.name}</span>
                          ) : isMiddleDay ? (
                            <span className="block h-4"></span> // Empty space to maintain height
                          ) : (
                            <span className="block h-4"></span> // Empty space for last day
                          )}
                          
                          {/* Resize handle for end */}
                          {isLastDay && (
                            <div className="absolute right-0 top-0 w-2 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white bg-opacity-30 rounded-r"></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Task Creation Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Task</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Task Name</label>
                  <input
                    type="text"
                    value={modalTask.name}
                    onChange={(e) => setModalTask(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter task name..."
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={modalTask.category}
                    onChange={(e) => setModalTask(prev => ({ ...prev, category: e.target.value as TaskCategory }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Review">Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={modalTask.startDate}
                      onChange={(e) => setModalTask(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={modalTask.endDate}
                      onChange={(e) => setModalTask(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={createTask}
                  disabled={!modalTask.name.trim()}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded-md"
                >
                  Create Task
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskPlanner;