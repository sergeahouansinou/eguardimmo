<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Requests;

use App\Modules\Parties\Actions\ImportParties;
use Illuminate\Foundation\Http\FormRequest;

final class ImportPartiesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Les lignes sont revalidées une à une par l'action, qui renvoie toutes les erreurs d'un coup.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'client_id' => ['required', 'uuid'],
            'allow_duplicates' => ['boolean'],
            'rows' => ['required', 'array', 'list', 'min:1', 'max:'.ImportParties::MAX_LIGNES],
            'rows.*' => ['array'],
        ];
    }

    public function clientId(): string
    {
        return (string) $this->validated('client_id');
    }

    public function allowDuplicates(): bool
    {
        return (bool) $this->validated('allow_duplicates', false);
    }

    /**
     * @return list<array<array-key, mixed>>
     */
    public function rows(): array
    {
        /** @var list<array<array-key, mixed>> $lignes */
        $lignes = $this->validated('rows');

        return $lignes;
    }
}
