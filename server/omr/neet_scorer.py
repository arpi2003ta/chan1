def score_column(student_answers, correct_answers, col_num):
    results = {
        'col_num': col_num,
        'questions': [],
        'mandatory_correct': 0,
        'mandatory_wrong': 0,
        'mandatory_unattempted': 0,
        'optional_correct': 0,
        'optional_wrong': 0,
        'optional_counted': 0,
        'optional_skipped': 0,
        'total_marks': 0,
        'max_possible': (35 + 10) * 4,
    }
    
    mandatory_marks = 0
    optional_marks = 0
    
    # NEET rules: 35 mandatory, 15 optional (only 10 counted)
    mandatory_section = list(zip(range(35), student_answers[:35], correct_answers[:35]))
    optional_section = list(zip(range(35, 50), student_answers[35:50], correct_answers[35:50]))
    
    for q_idx, s_ans, c_ans in mandatory_section:
        marks = 0
        status = ''
        if s_ans == -1:
            marks = 0
            status = 'unattempted'
            results['mandatory_unattempted'] += 1
        elif s_ans == c_ans:
            marks = 4
            status = 'correct'
            results['mandatory_correct'] += 1
        else:
            marks = -1 # User specified -1 for wrong
            status = 'wrong'
            results['mandatory_wrong'] += 1
        
        mandatory_marks += marks
        results['questions'].append({'q_num': q_idx + 1, 'marks': marks, 'status': status})
    
    attempted_optional = [i for i, ans in enumerate(student_answers[35:50]) if ans != -1]
    counted_indices = set(attempted_optional[:10]) # Only first 10 attempted are counted
    
    for i, (s_ans, c_ans) in enumerate(zip(student_answers[35:50], correct_answers[35:50])):
        q_idx = i + 35
        marks = 0
        status = ''
        is_counted = i in counted_indices
        
        if s_ans == -1:
            status = 'unattempted'
            results['optional_skipped'] += 1
        elif not is_counted:
            status = 'not_counted'
        elif s_ans == c_ans:
            marks = 4
            status = 'correct'
            results['optional_correct'] += 1
            results['optional_counted'] += 1
            optional_marks += marks
        else:
            marks = -1
            status = 'wrong'
            results['optional_wrong'] += 1
            results['optional_counted'] += 1
            optional_marks += marks
            
        results['questions'].append({'q_num': q_idx + 1, 'marks': marks, 'status': status, 'counted': is_counted})
    
    results['total_marks'] = mandatory_marks + optional_marks
    return results

def calculate_neet_score(student_all_answers, correct_all_answers):
    report = {
        'columns': [],
        'total_marks': 0,
        'max_marks': 720,
        'total_correct': 0,
        'total_wrong': 0,
        'total_unattempted': 0,
    }
    
    total = 0
    for col_num in range(1, 5):
        col_key = f"col_{col_num}"
        s_ans = student_all_answers.get(col_key, [-1] * 50)
        c_ans = correct_all_answers.get(col_key, [0] * 50)
        
        col_result = score_column(s_ans, c_ans, col_num)
        report['columns'].append(col_result)
        total += col_result['total_marks']
        
        report['total_correct'] += col_result['mandatory_correct'] + col_result['optional_correct']
        report['total_wrong'] += col_result['mandatory_wrong'] + col_result['optional_wrong']
        report['total_unattempted'] += col_result['mandatory_unattempted'] + col_result['optional_skipped']
    
    report['total_marks'] = max(0, total)
    return report
