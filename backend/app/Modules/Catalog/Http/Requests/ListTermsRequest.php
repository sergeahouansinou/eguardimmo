<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Requests;

use App\Modules\Catalog\Enums\VocabularyKey;
use Illuminate\Foundation\Http\FormRequest;

final class ListTermsRequest extends FormRequest
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
        return ['include_inactive' => ['nullable', 'boolean']];
    }

    public function vocabulary(): VocabularyKey
    {
        return VocabularyKey::from((string) $this->route('vocabulary'));
    }

    public function includeInactive(): bool
    {
        return $this->boolean('include_inactive');
    }
}
