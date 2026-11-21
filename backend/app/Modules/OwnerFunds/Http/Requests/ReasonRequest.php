<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Motif obligatoire d'un échec, d'un retour bancaire ou d'une annulation.
 */
final class ReasonRequest extends FormRequest
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
        return ['reason' => ['required', 'string', 'min:3', 'max:500']];
    }

    public function reason(): string
    {
        return trim((string) $this->validated('reason'));
    }
}
