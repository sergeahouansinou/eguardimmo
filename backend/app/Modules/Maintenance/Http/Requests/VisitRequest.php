<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use App\Modules\Maintenance\Data\VisitData;
use App\Modules\Maintenance\Enums\VisitSlot;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class VisitRequest extends FormRequest
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
            'scheduled_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'slot' => ['required', Rule::enum(VisitSlot::class)],
            'presence_required' => ['nullable', 'boolean'],
            'contact_name' => ['nullable', 'string', 'max:120'],
            'contact_phone' => ['nullable', 'string', 'max:32', 'regex:/^[0-9+().\\s-]{6,32}$/'],
        ];
    }

    public function toData(): VisitData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new VisitData(
            (string) $v['scheduled_on'],
            VisitSlot::from((string) $v['slot']),
            (bool) ($v['presence_required'] ?? false),
            isset($v['contact_name']) ? trim((string) $v['contact_name']) : null,
            isset($v['contact_phone']) ? trim((string) $v['contact_phone']) : null,
        );
    }
}
