<?php

declare(strict_types=1);

namespace App\Modules\Listings\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ArchiveListingRequest extends FormRequest
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
        return ['lock_version' => ['required', 'integer', 'min:1']];
    }

    public function lockVersion(): int
    {
        return (int) $this->validated('lock_version');
    }
}
