<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use App\Modules\Maintenance\Data\NewInterventionData;
use App\Modules\Maintenance\Enums\Priority;
use App\Modules\Maintenance\Enums\ReportedUrgency;
use App\Modules\Maintenance\Http\Support\IdempotencyHeader;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreInterventionRequest extends FormRequest
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
            'lease_id' => ['nullable', 'uuid'],
            'unit_id' => ['nullable', 'uuid'],
            'common_area' => ['nullable', 'boolean'],
            'mandate_id' => ['nullable', 'uuid'],
            'nature_term_id' => ['required', 'uuid'],
            'title' => ['required', 'string', 'min:3', 'max:120'],
            'description' => ['required', 'string', 'min:3', 'max:1000'],
            'room' => ['nullable', 'string', 'max:80'],
            'priority' => ['nullable', Rule::enum(Priority::class)],
            'reported_urgency' => ['nullable', Rule::enum(ReportedUrgency::class)],
            'availability' => ['nullable', 'string', 'max:200'],
        ];
    }

    public function toData(): NewInterventionData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new NewInterventionData(
            isset($v['lease_id']) ? (string) $v['lease_id'] : null,
            isset($v['unit_id']) ? (string) $v['unit_id'] : null,
            (bool) ($v['common_area'] ?? false),
            isset($v['mandate_id']) ? (string) $v['mandate_id'] : null,
            (string) $v['nature_term_id'],
            trim((string) $v['title']),
            trim((string) $v['description']),
            isset($v['room']) ? trim((string) $v['room']) : null,
            isset($v['reported_urgency']) ? ReportedUrgency::from((string) $v['reported_urgency']) : null,
            isset($v['priority']) ? Priority::from((string) $v['priority']) : null,
            isset($v['availability']) ? trim((string) $v['availability']) : null,
            IdempotencyHeader::read($this),
        );
    }
}
