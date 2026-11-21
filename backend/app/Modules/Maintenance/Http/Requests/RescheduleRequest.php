<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use App\Modules\Maintenance\Enums\VisitSlot;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class RescheduleRequest extends FormRequest
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
            'requested_on' => ['required', 'date_format:Y-m-d', 'after:today'],
            'slot' => ['required', Rule::enum(VisitSlot::class)],
        ];
    }

    public function requestedOn(): string
    {
        return (string) $this->validated('requested_on');
    }

    public function slot(): VisitSlot
    {
        return VisitSlot::from((string) $this->validated('slot'));
    }
}
