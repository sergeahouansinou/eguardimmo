<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Requests;

use App\Modules\Inspections\Enums\RemarkAnswer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class AnswerInspectionRemarkRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'answer' => ['required', 'string', Rule::enum(RemarkAnswer::class)],
            'body' => ['required', 'string', 'min:2', 'max:1000'],
        ];
    }

    public function decision(): RemarkAnswer
    {
        return RemarkAnswer::from((string) $this->validated('answer'));
    }

    public function text(): string
    {
        return (string) $this->validated('body');
    }
}
