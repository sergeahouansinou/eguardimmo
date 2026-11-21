<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use App\Modules\Maintenance\Data\UpdateInterventionData;
use App\Modules\Maintenance\Enums\Priority;
use App\Modules\Maintenance\Enums\Responsibility;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateInterventionRequest extends FormRequest
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
            'title' => ['sometimes', 'string', 'min:3', 'max:120'],
            'description' => ['sometimes', 'string', 'min:3', 'max:1000'],
            'room' => ['sometimes', 'nullable', 'string', 'max:80'],
            'availability' => ['sometimes', 'nullable', 'string', 'max:200'],
            'priority' => ['sometimes', Rule::in([Priority::Normal->value, Priority::Low->value])],
            'responsibility' => ['sometimes', Rule::enum(Responsibility::class)],
            'due_on' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:2000-01-01'],
            'estimated_amount' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000000000'],
            'custom_fields' => ['sometimes', 'nullable', 'array', 'max:50'],
        ];
    }

    public function toData(): UpdateInterventionData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();
        $lock = (int) $v['lock_version'];
        unset($v['lock_version']);

        return new UpdateInterventionData($lock, $v);
    }
}
