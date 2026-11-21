<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class PublishMandantStatementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'lock_version' => ['required', 'integer', 'min:1'],
            'status' => ['prohibited'],
            'published_at' => ['prohibited'],
            'snapshot' => ['prohibited'],
        ];
    }

    public function lockVersion(): int
    {
        return $this->integer('lock_version');
    }
}
