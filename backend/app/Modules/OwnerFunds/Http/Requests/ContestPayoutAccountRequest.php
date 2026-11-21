<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ContestPayoutAccountRequest extends FormRequest
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
        return ['access_id' => ['required', 'uuid']];
    }

    public function accessId(): string
    {
        return (string) $this->validated('access_id');
    }
}
