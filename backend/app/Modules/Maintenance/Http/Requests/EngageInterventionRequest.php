<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use App\Modules\Maintenance\Data\EngageData;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class EngageInterventionRequest extends FormRequest
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
            'basis' => ['nullable', Rule::in(['under_ceiling', 'emergency'])],
            'reason' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function toData(): EngageData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new EngageData((string) ($v['basis'] ?? 'under_ceiling'), isset($v['reason']) ? trim((string) $v['reason']) : null, (int) $v['lock_version']);
    }
}
