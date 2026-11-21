<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Requests;

use App\Modules\Reporting\Enums\ReportSection;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateReportRequest extends FormRequest
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
            'lock_version' => ['required', 'integer', 'min:1'],
            'sections' => ['sometimes', 'array', 'min:1'],
            'sections.*' => [Rule::in(ReportSection::values()), 'distinct'],
            'options' => ['sometimes', 'array:letterhead,reminder_detail,receipts_attached'],
            'options.letterhead' => ['boolean'],
            'options.reminder_detail' => ['boolean'],
            'options.receipts_attached' => ['boolean'],
            'notify' => ['sometimes', 'boolean'],
        ];
    }

    public function lockVersion(): int
    {
        return $this->integer('lock_version');
    }

    /**
     * @return array{sections?: list<string>, options?: array<string, bool>, notify?: bool}
     */
    public function changes(): array
    {
        $changements = [];

        if ($this->has('sections')) {
            $changements['sections'] = array_values(array_map(strval(...), (array) $this->validated('sections')));
        }

        if ($this->has('options')) {
            $changements['options'] = array_map(fn (mixed $v): bool => $v === true, (array) $this->validated('options'));
        }

        if ($this->has('notify')) {
            $changements['notify'] = $this->boolean('notify');
        }

        return $changements;
    }
}
