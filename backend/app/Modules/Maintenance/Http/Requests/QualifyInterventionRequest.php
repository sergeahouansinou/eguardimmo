<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use App\Modules\Maintenance\Data\QualifyData;
use App\Modules\Maintenance\Enums\Priority;
use App\Modules\Maintenance\Enums\Responsibility;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class QualifyInterventionRequest extends FormRequest
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
            'nature_term_id' => ['nullable', 'uuid'],
            'priority' => ['required', Rule::enum(Priority::class)],
            'responsibility' => ['required', Rule::enum(Responsibility::class)],
            'unit_id' => ['nullable', 'uuid'],
            'common_area' => ['nullable', 'boolean'],
            'mandate_id' => ['nullable', 'uuid'],
            'due_on' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:2000-01-01'],
            'estimated_amount' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'room' => ['nullable', 'string', 'max:80'],
            'custom_fields' => ['nullable', 'array', 'max:50'],
        ];
    }

    public function toData(): QualifyData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new QualifyData(
            (int) $v['lock_version'],
            isset($v['nature_term_id']) ? (string) $v['nature_term_id'] : null,
            Priority::from((string) $v['priority']),
            Responsibility::from((string) $v['responsibility']),
            isset($v['unit_id']) ? (string) $v['unit_id'] : null,
            (bool) ($v['common_area'] ?? false),
            isset($v['mandate_id']) ? (string) $v['mandate_id'] : null,
            isset($v['due_on']) ? (string) $v['due_on'] : null,
            isset($v['estimated_amount']) ? (int) $v['estimated_amount'] : null,
            isset($v['room']) ? trim((string) $v['room']) : null,
            isset($v['custom_fields']) && is_array($v['custom_fields']) ? $v['custom_fields'] : null,
        );
    }
}
