<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Requests;

use App\Modules\Reporting\Data\NewReportsData;
use App\Modules\Reporting\Enums\PeriodKind;
use App\Modules\Reporting\Enums\ReportSection;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreReportsRequest extends FormRequest
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
            'period_kind' => ['required', Rule::enum(PeriodKind::class)],
            'period_start' => ['required', 'date_format:Y-m-d'],
            'period_end' => ['required', 'date_format:Y-m-d'],
            'mandant_ids' => ['required', 'array', 'min:1', 'max:'.(int) config('reporting.batch_max')],
            'mandant_ids.*' => ['uuid', 'distinct'],
            'sections' => ['nullable', 'array', 'min:1'],
            'sections.*' => [Rule::in(ReportSection::values()), 'distinct'],
            'options' => ['nullable', 'array:letterhead,reminder_detail,receipts_attached'],
            'options.letterhead' => ['boolean'],
            'options.reminder_detail' => ['boolean'],
            'options.receipts_attached' => ['boolean'],
            'mode' => ['nullable', Rule::in(['draft', 'generate'])],
            'notify' => ['nullable', 'boolean'],
        ];
    }

    public function toData(): NewReportsData
    {
        $sections = $this->validated('sections');
        $options = $this->validated('options');
        $options = is_array($options) ? $options : [];

        return new NewReportsData(
            PeriodKind::from($this->string('period_kind')->toString()),
            $this->string('period_start')->toString(),
            $this->string('period_end')->toString(),
            array_values(array_map(strval(...), (array) $this->validated('mandant_ids'))),
            is_array($sections) ? array_values(array_map(strval(...), $sections)) : ReportSection::values(),
            [
                'letterhead' => ($options['letterhead'] ?? true) === true,
                'reminder_detail' => ($options['reminder_detail'] ?? false) === true,
                'receipts_attached' => ($options['receipts_attached'] ?? false) === true,
            ],
            $this->input('mode', 'generate') === 'generate',
            $this->boolean('notify', true),
        );
    }
}
