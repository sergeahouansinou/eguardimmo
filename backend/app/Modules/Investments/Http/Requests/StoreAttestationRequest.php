<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use LogicException;

final class StoreAttestationRequest extends FormRequest
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
            'income_year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'interest' => ['required', 'integer', 'min:0', 'max:100000000000'],
            'insurance' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'fees' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'document' => ['required', 'file', 'max:10240'],
            'currency' => ['prohibited'],
        ];
    }

    public function upload(): UploadedFile
    {
        $fichier = $this->file('document');

        return $fichier instanceof UploadedFile ? $fichier : throw new LogicException('Pièce absente après validation.');
    }
}
