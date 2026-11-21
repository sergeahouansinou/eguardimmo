<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use LogicException;

final class ImportScheduleRequest extends FormRequest
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
        return ['file' => ['required', 'file', 'max:256', 'extensions:csv,txt'], 'lock_version' => ['required', 'integer', 'min:1']];
    }

    public function upload(): UploadedFile
    {
        $fichier = $this->file('file');

        return $fichier instanceof UploadedFile ? $fichier : throw new LogicException('Fichier absent après validation.');
    }
}
