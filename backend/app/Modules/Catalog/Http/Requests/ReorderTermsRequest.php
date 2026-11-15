<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Requests;

use App\Modules\Catalog\Enums\VocabularyKey;
use Illuminate\Foundation\Http\FormRequest;

final class ReorderTermsRequest extends FormRequest
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
            'term_ids' => ['required', 'array', 'min:1', 'max:500'],
            'term_ids.*' => ['required', 'uuid', 'distinct'],
        ];
    }

    public function vocabulary(): VocabularyKey
    {
        return VocabularyKey::from((string) $this->route('vocabulary'));
    }

    /**
     * @return list<string>
     */
    public function termIds(): array
    {
        /** @var list<string> $ids */
        $ids = array_values($this->validated('term_ids'));

        return $ids;
    }
}
