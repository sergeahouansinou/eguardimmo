<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Modules\Leases\Enums\InsuranceRejectionReason;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class RejectInsuranceRequest extends FormRequest
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
            'reason' => ['required', 'string', Rule::enum(InsuranceRejectionReason::class)],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function reason(): InsuranceRejectionReason
    {
        return InsuranceRejectionReason::from((string) $this->validated('reason'));
    }

    public function note(): ?string
    {
        $note = $this->validated('note');

        return is_string($note) && trim($note) !== '' ? trim($note) : null;
    }
}
